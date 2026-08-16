import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlVocabularyActivationRepository } from "../src/infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";

class BatchConnection {
  constructor({ revision = 12, active = false } = {}) {
    this.revision = revision;
    this.active = active;
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
  }

  async beginTransaction() {}
  async commit() { this.committed = true; }
  async rollback() { this.rolledBack = true; }
  release() {}

  target(publicId, id) {
    return {
      vocabulary_entry_id: id,
      vocabulary_id: publicId,
      progress_user_id: this.active ? 7 : null,
      progress_status: this.active ? "active" : null,
      progress_box: this.active ? 1 : null,
      progress_due_date: this.active ? "2026-08-16" : null,
      progress_introduced_on: this.active ? "2026-08-16" : null,
      progress_introduced_via: this.active ? "daily" : null
    };
  }

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });

    if (/SELECT DISTINCT ve\.id AS vocabulary_entry_id/u.test(sql)) {
      return [[this.target("vocab-1", 31), this.target("vocab-2", 32)], []];
    }
    if (/UPDATE user_state_revisions[\s\S]*WHERE user_id = \? AND revision = \?/u.test(sql)) {
      const expected = Number(parameters[1]);
      if (this.revision !== expected) return [{ affectedRows: 0 }, []];
      this.revision += 1;
      return [{ affectedRows: 1 }, []];
    }
    if (/SELECT revision FROM user_state_revisions/u.test(sql)) {
      return [[{ revision: this.revision }], []];
    }
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 2 }, []];
    if (/INSERT INTO user_daily_stats/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

class BatchPool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

const command = {
  expectedRevision: 12,
  vocabularyIds: ["vocab-1", "vocab-2"],
  day: "2026-08-16",
  source: "daily"
};

describe("MySqlVocabularyActivationRepository batches", () => {
  it("persists many automatic activations with one revision claim and one daily increment", async () => {
    const connection = new BatchConnection();
    const repository = new MySqlVocabularyActivationRepository(new BatchPool(connection));

    const revision = await repository.activateBatch(7, command);

    assert.equal(revision, 13);
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    assert.equal(connection.calls.length, 4,
      "batch hot path should use target lookup, revision claim, bulk progress write and daily write");

    const progressWrite = connection.calls.find(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql));
    assert.ok(progressWrite);
    assert.deepEqual(progressWrite.parameters, [
      7, 31, "2026-08-16", "2026-08-16", "daily",
      7, 32, "2026-08-16", "2026-08-16", "daily"
    ]);

    const dailyWrite = connection.calls.find(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql));
    assert.deepEqual(dailyWrite.parameters, [7, "2026-08-16", 2]);
  });

  it("treats an immediately retried identical batch as idempotent", async () => {
    const connection = new BatchConnection({ revision: 13, active: true });
    const repository = new MySqlVocabularyActivationRepository(new BatchPool(connection));

    const revision = await repository.activateBatch(7, command);

    assert.equal(revision, 13);
    assert.equal(connection.committed, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql)), false,
      "retry must not increment new_added twice");
  });
});
