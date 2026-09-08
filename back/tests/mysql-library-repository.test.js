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

class QueryPool {
  constructor(rows) {
    this.rows = rows;
    this.calls = [];
  }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    return [this.rows, []];
  }
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

describe("MySqlLibraryRepository collection Leitner progress", () => {
  it("returns the number of collection words already introduced to Leitner", async () => {
    const pool = new QueryPool([{
      public_id: "collection-1",
      slug: "collection-1",
      title: "Collection 1",
      description: "",
      kind: "book",
      visibility: "public",
      status: "published",
      content_version: 1,
      metadata_json: "{}",
      is_default: 0,
      word_count: 4,
      leitner_word_count: 2,
      subscription_status: "active",
      last_seen_version: 1
    }]);
    const repository = new MySqlLibraryRepository(pool);

    const [collection] = await repository.listForUser("user-1");

    assert.equal(collection.leitnerWordCount, 2);
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0].sql, /user_vocabulary_progress/u);
    assert.match(pool.calls[0].sql, /uvp\.status = 'active'/u);
    assert.match(pool.calls[0].sql, /uvp\.introduced_on IS NOT NULL/u);
    assert.match(pool.calls[0].sql, /uvp\.mastered_at IS NOT NULL/u);
    assert.match(
      pool.calls[0].sql,
      /JSON_EXTRACT\(c\.metadata_json, '\$\.sourceFile'\).*NOT LIKE 'listening\/episodes\/%'/su,
    );
    assert.deepEqual(pool.calls[0].parameters, ["user-1", "user-1", "user-1"]);
  });

  it("keeps episode-owned vocabulary collections out of Library list and detail queries", async () => {
    const pool = new QueryPool([]);
    const repository = new MySqlLibraryRepository(pool);

    await repository.listForUser("user-1");
    await assert.rejects(
      repository.getForUser("episode-collection", "user-1"),
      (error) => error?.code === "COLLECTION_NOT_FOUND",
    );

    assert.equal(pool.calls.length, 2);
    for (const call of pool.calls) {
      assert.match(
        call.sql,
        /JSON_EXTRACT\(c\.metadata_json, '\$\.sourceFile'\).*NOT LIKE 'listening\/episodes\/%'/su,
      );
    }
  });
});
