import assert from "node:assert/strict";
import test from "node:test";

import { MySqlCollectionSourceRepository } from "../src/infrastructure/persistence/mysql/MySqlCollectionSourceRepository.js";

class FinalizeConnection {
  constructor() {
    this.calls = [];
    this.committed = false;
    this.released = false;
  }

  async beginTransaction() {}

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT DISTINCT sve\.sentence_id/u.test(sql)) {
      return [[{ sentence_id: 41 }], []];
    }
    if (/DELETE vf\s+FROM vocabulary_forms/u.test(sql)) {
      return [{ affectedRows: 2 }, []];
    }
    return [{ affectedRows: 1 }, []];
  }

  async commit() {
    this.committed = true;
  }

  async rollback() {
    throw new Error("finalize should not roll back in this test");
  }

  release() {
    this.released = true;
  }
}

class Pool {
  constructor(connection) {
    this.connection = connection;
  }

  async getConnection() {
    return this.connection;
  }
}

test("managed source finalization removes orphan links while preserving curated and externally-used data", async () => {
  const connection = new FinalizeConnection();
  const repository = new MySqlCollectionSourceRepository(new Pool(connection));

  const result = await repository.finalize();

  assert.deepEqual(result, {
    orphanSentenceLinksRemoved: 1,
    orphanFormsRemoved: 2
  });
  assert.equal(connection.committed, true);
  assert.equal(connection.released, true);

  const sql = connection.calls.map((call) => call.sql).join("\n");
  assert.match(sql, /collection_entry_examples/u);
  assert.match(sql, /collection_entry_forms/u);
  assert.match(sql, /is_curated = FALSE/u);
  assert.match(sql, /JSON_EXTRACT\(c\.metadata_json, '\$\.sourceFile'\)/u);
});
