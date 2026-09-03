import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { seedSentencePractice } from "../src/infrastructure/persistence/mysql/seedSentencePractice.js";

const sourceUrl = new URL("../../ui/data/IELTS_Listening_Core_1500.md", import.meta.url);

class FakeSentenceSeedConnection {
  constructor(pool) {
    this.pool = pool;
    this.pendingTotal = 0;
    this.pendingHash = null;
    this.insertCalls = 0;
    this.deletedStaleRows = false;
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
      this.pendingTotal += parameters.length / 8;
      this.pendingHash = parameters[6];
      return [{ affectedRows: parameters.length / 8 }];
    }
    if (sql.includes("DELETE FROM sentences")) {
      this.deletedStaleRows = true;
      return [{ affectedRows: 0 }];
    }
    throw new Error(`Unexpected seed connection query: ${sql}`);
  }

  async commit() {
    this.committed = true;
    this.pool.state = {
      total: this.pendingTotal,
      sourceItems: 1_500,
      sourceHashes: 1,
      sourceHash: this.pendingHash,
      activeTotal: this.pendingTotal
    };
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
    this.state = { total: 0, sourceItems: 0, sourceHashes: 0, sourceHash: null, activeTotal: 0 };
    this.connections = [];
    this.beginCalls = 0;
    this.readQueries = [];
  }

  async execute(sql) {
    this.readQueries.push(sql);
    if (sql.includes("FROM sentences")) {
      return [[{
        total: this.state.total,
        source_items: this.state.sourceItems,
        source_hashes: this.state.sourceHashes,
        source_hash: this.state.sourceHash,
        active_total: this.state.activeTotal
      }]];
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
  it("seeds 4,500 independent sentence rows without looking up vocabulary IDs", async () => {
    const sourceText = await readFile(sourceUrl, "utf8");
    const pool = new FakeSentenceSeedPool();

    const first = await seedSentencePractice({ pool, sourceText });

    assert.equal(first.changed, true);
    assert.equal(first.sourceItemCount, 1_500);
    assert.equal(first.sentenceCount, 4_500);
    assert.equal(pool.connections.length, 1);
    assert.equal(pool.connections[0].pendingTotal, 4_500);
    assert.equal(pool.connections[0].insertCalls, 18);
    assert.equal(pool.connections[0].deletedStaleRows, true);
    assert.equal(pool.connections[0].committed, true);
    assert.equal(pool.connections[0].rolledBack, false);
    assert.equal(pool.connections[0].released, true);
    assert.equal(pool.readQueries.some((sql) => /vocabulary_entries|vocabulary_forms|collection_entries/u.test(sql)), false);

    const second = await seedSentencePractice({ pool, sourceText });

    assert.equal(second.changed, false);
    assert.equal(second.sourceHash, first.sourceHash);
    assert.equal(pool.connections.length, 1, "an unchanged rerun must not open a write transaction");
  });
});
