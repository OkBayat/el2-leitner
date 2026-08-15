import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlReviewProgressRepository } from "../src/infrastructure/persistence/mysql/MySqlReviewProgressRepository.js";
import { reviewEventKey } from "../src/infrastructure/persistence/mysql/MySqlLearningStateRepository.js";

class PatternConnection {
  constructor({ revision = 8, existingEvent = false } = {}) {
    this.revision = revision;
    this.existingEvent = existingEvent;
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
    if (/SELECT id FROM review_events WHERE event_key/u.test(sql)) {
      return [this.existingEvent ? [{ id: 99 }] : [], []];
    }
    if (/SELECT ve\.id AS vocabulary_entry_id/u.test(sql)) {
      return [[{ vocabulary_entry_id: 30, collection_id: 10 }], []];
    }
    if (/SELECT id FROM practice_sessions/u.test(sql)) return [[{ id: 55 }], []];
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO user_daily_stats/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO review_events/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/UPDATE user_state_revisions/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

class PatternPool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

function command() {
  return {
    expectedRevision: 8,
    practiceSessionId: "session-1",
    word: {
      id: "vocab-monday",
      box: 2,
      due: "2026-08-17",
      attempts: 4,
      correct: 3,
      mistakes: 1,
      currentStreak: 2,
      introducedOn: "2026-08-15",
      addedSource: "daily",
      lastReviewed: "2026-08-15T08:00:00.000Z",
      lastPromotedDay: "2026-08-15",
      blockedUntil: null,
      masteredAt: null
    },
    event: {
      at: "2026-08-15T08:00:00.000Z",
      day: "2026-08-15",
      wordId: "vocab-monday",
      term: "Monday",
      answer: "monday",
      correct: true,
      mode: "review",
      promoted: true,
      previousBox: 1,
      newBox: 2,
      mistakeNumber: null
    },
    daily: {
      attempts: 12,
      correct: 10,
      wrong: 2,
      newAdded: 10,
      sessions: 0,
      durationSeconds: 0
    }
  };
}

describe("MySqlReviewProgressRepository", () => {
  it("persists one word, one day and one review event in one transaction", async () => {
    const connection = new PatternConnection();
    const repository = new MySqlReviewProgressRepository(new PatternPool(connection));

    const revision = await repository.record(7, command());

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    assert.equal(connection.calls.filter(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)).length, 1);
    assert.equal(connection.calls.filter(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql)).length, 1);
    assert.equal(connection.calls.filter(({ sql }) => /INSERT INTO review_events/u.test(sql)).length, 1);
    assert.equal(connection.calls.filter(({ sql }) => /UPDATE user_state_revisions/u.test(sql)).length, 1);
    assert.equal(connection.calls.some(({ sql }) => /FROM user_vocabulary_progress WHERE user_id/u.test(sql)), false,
      "the review command must not scan the user's whole progress set");
  });

  it("treats the immediately retried identical event as idempotent", async () => {
    const connection = new PatternConnection({ revision: 9, existingEvent: true });
    const repository = new MySqlReviewProgressRepository(new PatternPool(connection));

    const revision = await repository.record(7, command());

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)), false);
    const eventProbe = connection.calls.find(({ sql }) => /SELECT id FROM review_events WHERE event_key/u.test(sql));
    assert.equal(eventProbe.parameters[0], reviewEventKey(7, command().event));
  });

  it("rejects a stale revision before mutating progress", async () => {
    const connection = new PatternConnection({ revision: 11 });
    const repository = new MySqlReviewProgressRepository(new PatternPool(connection));

    await assert.rejects(() => repository.record(7, command()), /updated by another session/u);
    assert.equal(connection.committed, false);
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)), false);
  });
});
