import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MySqlLibraryRepository } from "../src/infrastructure/persistence/mysql/MySqlLibraryRepository.js";

class ScriptedConnection {
  constructor(results) {
    this.results = [...results];
    this.calls = [];
    this.committed = false;
  }
  async beginTransaction() {}
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (!this.results.length) throw new Error(`Unexpected SQL: ${sql}`);
    return this.results.shift();
  }
  async commit() { this.committed = true; }
  async rollback() {}
  release() {}
}

class Pool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

function importConnection() {
  return new ScriptedConnection([
    [[{ id: 1, public_id: "collection-1", content_version: 4 }], []],
    [[{ max_position: 7 }], []],
    [[{ id: 10, public_id: "vocab-1", primary_form: "alpha", normalized_form: "alpha" }], []],
    [{ affectedRows: 1 }, []],
    [[], []],
    [{ affectedRows: 1, insertId: 20 }, []],
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []]
  ]);
}

const parsed = {
  sections: [],
  entries: [{ sourceNumber: 1, position: 1, primaryForm: "alpha", acceptedForms: ["alpha"], sectionPath: null }]
};

describe("MySqlLibraryRepository import ordering", () => {
  it("appends new imports after the current collection order", async () => {
    const connection = importConnection();
    const repository = new MySqlLibraryRepository(new Pool(connection));

    const result = await repository.importEntries("collection-1", parsed, "append");

    assert.equal(result.added, 1);
    const membershipInsert = connection.calls.find((call) => /INSERT INTO collection_entries/u.test(call.sql));
    assert.equal(membershipInsert.parameters[4], 8);
    assert.equal(connection.committed, true);
  });

  it("uses source numbering when a replace import defines the full order", async () => {
    const connection = importConnection();
    connection.results.splice(6, 0, [[{ id: 20, vocabulary_entry_id: 10 }], []]);
    const repository = new MySqlLibraryRepository(new Pool(connection));

    const result = await repository.importEntries("collection-1", parsed, "replace");

    assert.equal(result.removed, 0);
    const membershipInsert = connection.calls.find((call) => /INSERT INTO collection_entries/u.test(call.sql));
    assert.equal(membershipInsert.parameters[4], 1);
    assert.equal(connection.committed, true);
  });
});
