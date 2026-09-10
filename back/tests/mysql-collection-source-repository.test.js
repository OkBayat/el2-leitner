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

class EmptyCollectionSyncConnection {
  constructor() {
    this.calls = [];
    this.committed = false;
    this.released = false;
  }

  async beginTransaction() {}

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT \* FROM collections WHERE slug/u.test(sql)) {
      return [[{
        id: 7,
        public_id: "grammar-for-ielts",
        slug: "grammar-for-ielts",
        kind: "book",
        status: "published",
        source_hash: "old-source-hash",
        content_version: 1,
        archived_at: null
      }], []];
    }
    if (/SELECT id FROM collection_sections/u.test(sql)) return [[{ id: 11 }], []];
    if (/SELECT id, vocabulary_entry_id FROM collection_entries/u.test(sql)) return [[], []];
    return [{ affectedRows: 1 }, []];
  }

  async commit() {
    this.committed = true;
  }

  async rollback() {
    throw new Error("empty collection sync should not roll back in this test");
  }

  release() {
    this.released = true;
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

test("empty managed collections retain desired sections while reconciling stale sections", async () => {
  const connection = new EmptyCollectionSyncConnection();
  const repository = new MySqlCollectionSourceRepository(new Pool(connection));

  const result = await repository.sync({
    slug: "grammar-for-ielts",
    publicId: "grammar-for-ielts",
    sourceHash: "new-source-hash",
    fileName: "grammar-for-ielts.md",
    kind: "book",
    description: null,
    isDefault: false,
    sourceItemCount: 0,
    duplicateAliasCount: 0,
    parsed: {
      title: "Grammar for IELTS",
      sections: [{ path: "Unit 1 — Present tenses", title: "Unit 1 — Present tenses", position: 1 }],
      entries: []
    }
  });

  assert.equal(result.words, 0);
  assert.equal(connection.committed, true);
  assert.equal(connection.released, true);
  const sectionCleanup = connection.calls.find(({ sql }) => /DELETE FROM collection_sections/u.test(sql));
  assert.ok(sectionCleanup);
  assert.deepEqual(sectionCleanup.parameters, [7, "11"]);
});
