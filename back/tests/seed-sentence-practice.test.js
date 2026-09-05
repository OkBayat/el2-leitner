import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedSentenceCatalog } from "../src/infrastructure/persistence/mysql/seedSentencePractice.js";

class FakeSentenceSeedConnection {
  constructor(pool) {
    this.pool = pool;
    this.pendingInserts = [];
    this.pendingRefreshes = [];
    this.committed = false;
    this.rolledBack = false;
    this.released = false;
  }

  async beginTransaction() {
    this.pool.beginCalls += 1;
  }

  async execute(sql, parameters) {
    if (sql.startsWith("INSERT INTO sentences")) {
      for (let index = 0; index < parameters.length; index += 2) {
        const sentence = parameters[index];
        const hash = parameters[index + 1];
        assert.equal(typeof sentence, "string");
        assert.match(hash, /^[a-f0-9]{64}$/u);
        this.pendingInserts.push(sentence);
      }
      return [{ affectedRows: this.pendingInserts.length }];
    }

    if (sql.startsWith("UPDATE sentences")) {
      this.pendingRefreshes.push(...parameters);
      return [{ affectedRows: parameters.length }];
    }

    throw new Error(`Unexpected seed connection query: ${sql}`);
  }

  async commit() {
    this.committed = true;
    for (const sentence of this.pendingInserts) {
      this.pool.rows.set(sentence, { is_curated: 1, status: "active" });
    }
    for (const sentence of this.pendingRefreshes) {
      const current = this.pool.rows.get(sentence);
      if (current) this.pool.rows.set(sentence, { is_curated: 1, status: "active" });
    }
  }

  async rollback() {
    this.rolledBack = true;
  }

  release() {
    this.released = true;
  }
}

class FakeSentenceSeedPool {
  constructor() {
    this.rows = new Map();
    this.connections = [];
    this.beginCalls = 0;
    this.readQueries = [];
  }

  async execute(sql) {
    this.readQueries.push(sql);
    if (sql.includes("FROM sentences")) {
      return [[...this.rows.entries()].map(([sentence_text, row]) => ({
        sentence_text,
        ...row
      }))];
    }
    throw new Error(`Unexpected seed pool query: ${sql}`);
  }

  async getConnection() {
    const connection = new FakeSentenceSeedConnection(this);
    this.connections.push(connection);
    return connection;
  }
}

describe("curated sentence database seed", () => {
  it("inserts only missing sentence text and is idempotent without vocabulary lookups", async () => {
    const pool = new FakeSentenceSeedPool();
    const sentences = [
      "Please install the software before the meeting.",
      "It is easy to get into debt if you spend more than you earn.",
      "Please install the software before the meeting.",
    ];

    const first = await seedSentenceCatalog({ pool, sentences });
    assert.deepEqual(first, { changed: true, sentenceCount: 2, insertedCount: 2 });
    assert.equal(pool.rows.size, 2);
    assert.equal(pool.connections.length, 1);
    assert.equal(pool.connections[0].committed, true);
    assert.equal(pool.connections[0].rolledBack, false);
    assert.equal(pool.connections[0].released, true);
    assert.equal(pool.readQueries.some((sql) => /vocabulary_entries|vocabulary_forms|collection_entries/u.test(sql)), false);

    const second = await seedSentenceCatalog({ pool, sentences });
    assert.deepEqual(second, { changed: false, sentenceCount: 2, insertedCount: 0 });
    assert.equal(pool.connections.length, 1, "an unchanged rerun must not open a write transaction");
  });

  it("marks pre-existing curated rows so collection cleanup never deactivates shared catalog sentences", async () => {
    const pool = new FakeSentenceSeedPool();
    const sentence = "The bus was crowded this morning.";
    pool.rows.set(sentence, { is_curated: 0, status: "active" });

    const result = await seedSentenceCatalog({ pool, sentences: [sentence] });

    assert.deepEqual(result, { changed: true, sentenceCount: 1, insertedCount: 0 });
    assert.deepEqual(pool.rows.get(sentence), { is_curated: 1, status: "active" });
  });
});
