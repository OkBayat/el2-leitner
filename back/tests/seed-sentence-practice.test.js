import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { seedSentencePractice } from "../src/infrastructure/persistence/mysql/seedSentencePractice.js";

const sourceUrl = new URL("../../ui/data/IELTS_Listening_Core_1500.md", import.meta.url);

class FakeSentenceSeedConnection {
  constructor(pool) {
    this.pool = pool;
    this.pendingTexts = [];
    this.insertCalls = 0;
    this.committed = false;
    this.rolledBack = false;
    this.released = false;
  }

  async beginTransaction() {
    this.pool.beginCalls += 1;
  }

  async execute(sql, parameters) {
    if (sql.startsWith("INSERT INTO sentences")) {
      this.insertCalls += 1;
      this.pendingTexts.push(...parameters.map(String));
      assert.doesNotMatch(
        sql,
        /language_code|source_key|source_item_number|variant_number|category|source_hash/u
      );
      return [{ affectedRows: parameters.length }];
    }
    throw new Error(`Unexpected seed connection query: ${sql}`);
  }

  async commit() {
    this.committed = true;
    this.pendingTexts.forEach((sentenceText) => this.pool.activeTexts.add(sentenceText));
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
    this.activeTexts = new Set();
    this.connections = [];
    this.beginCalls = 0;
    this.readQueries = [];
  }

  async execute(sql) {
    this.readQueries.push(sql);
    if (sql.includes("FROM sentences")) {
      return [[...this.activeTexts].map((sentence_text) => ({ sentence_text }))];
    }
    throw new Error(`Unexpected seed pool query: ${sql}`);
  }

  async getConnection() {
    const connection = new FakeSentenceSeedConnection(this);
    this.connections.push(connection);
    return connection;
  }
}

describe("sentence-practice database seed", () => {
  it("seeds sentence text only, deduplicates identical rows, and stays idempotent", async () => {
    const sourceText = await readFile(sourceUrl, "utf8");
    const pool = new FakeSentenceSeedPool();

    const first = await seedSentencePractice({ pool, sourceText });

    assert.equal(first.changed, true);
    assert.equal(first.sourceItemCount, 1_500);
    assert.equal(first.sentenceCount, 4_500);
    assert.equal(first.uniqueSentenceCount, 4_499);
    assert.equal(first.insertedCount, 4_499);
    assert.equal(pool.activeTexts.size, 4_499);
    assert.equal(pool.connections.length, 1);
    assert.equal(pool.connections[0].pendingTexts.length, 4_499);
    assert.equal(pool.connections[0].insertCalls, 18);
    assert.equal(pool.connections[0].committed, true);
    assert.equal(pool.connections[0].rolledBack, false);
    assert.equal(pool.connections[0].released, true);
    assert.equal(
      pool.readQueries.some((sql) => /vocabulary_entries|vocabulary_forms|collection_entries|source_key|source_hash/u.test(sql)),
      false
    );

    const second = await seedSentencePractice({ pool, sourceText });

    assert.equal(second.changed, false);
    assert.equal(second.insertedCount, 0);
    assert.equal(pool.connections.length, 1, "an unchanged rerun must not open a write transaction");
  });
});
