import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlVocabularyActivationRepository } from "../src/infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";

class PatternConnection {
  constructor({ revision = 8, progress = null } = {}) {
    this.revision = revision;
    this.progress = progress;
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
  }

  async beginTransaction() {}
  async commit() { this.committed = true; }
  async rollback() { this.rolledBack = true; }
  release() {}

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT revision FROM user_state_revisions/u.test(sql)) return [[{ revision: this.revision }], []];
    if (/SELECT ve\.id AS vocabulary_entry_id/u.test(sql)) {
      return [[{
        vocabulary_entry_id: 30,
        progress_user_id: this.progress ? 7 : null,
        progress_status: this.progress?.status ?? null,
        progress_box: this.progress?.box ?? null,
        progress_due_date: this.progress?.due ?? null,
        progress_introduced_on: this.progress?.introducedOn ?? null,
        progress_introduced_via: this.progress?.introducedVia ?? null
      }], []];
    }
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO user_daily_stats/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/UPDATE user_state_revisions/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

class PatternPool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

const command = {
  expectedRevision: 8,
  vocabularyId: "vocab-monday",
  day: "2026-08-16"
};

describe("MySqlVocabularyActivationRepository", () => {
  it("activates one vocabulary row and increments only the current day's new-word count", async () => {
    const connection = new PatternConnection();
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    const revision = await repository.activate(7, command);

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    assert.equal(connection.calls.filter(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)).length, 1);
    assert.equal(connection.calls.filter(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql)).length, 1);
    assert.equal(connection.calls.filter(({ sql }) => /UPDATE user_state_revisions/u.test(sql)).length, 1);
    assert.equal(connection.calls.some(({ sql }) => /FROM user_vocabulary_progress WHERE user_id/u.test(sql)), false,
      "single-word activation must not scan the user's whole progress set");

    const progressWrite = connection.calls.find(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql));
    assert.deepEqual(progressWrite.parameters, [7, 30, "2026-08-16", "2026-08-16"]);
    const dailyWrite = connection.calls.find(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql));
    assert.deepEqual(dailyWrite.parameters, [7, "2026-08-16"]);
  });

  it("activates an unseen word even when a box-zero row exists only for metadata", async () => {
    const connection = new PatternConnection({
      progress: {
        status: "active",
        box: 0,
        due: null,
        introducedOn: null,
        introducedVia: null
      }
    });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    const revision = await repository.activate(7, command);

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.calls.filter(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)).length, 1);
  });

  it("treats the immediately retried identical activation as idempotent", async () => {
    const connection = new PatternConnection({
      revision: 9,
      progress: {
        status: "active",
        box: 1,
        due: "2026-08-16",
        introducedOn: "2026-08-16",
        introducedVia: "word-bank"
      }
    });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    const revision = await repository.activate(7, command);

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql)), false,
      "an immediate retry must not double-count the daily activation");
  });

  it("rejects a stale revision before mutating progress", async () => {
    const connection = new PatternConnection({ revision: 11 });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    await assert.rejects(() => repository.activate(7, command), /updated by another session/u);
    assert.equal(connection.committed, false);
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)), false);
  });
});
