import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MySqlEfficientLearningStateRepository,
  reviewFingerprint
} from "../src/infrastructure/persistence/mysql/MySqlEfficientLearningStateRepository.js";

class PatternConnection {
  constructor({ progress = [] } = {}) {
    this.calls = [];
    this.progress = progress;
    this.committed = false;
  }

  async beginTransaction() {}
  async commit() { this.committed = true; }
  async rollback() {}
  release() {}

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT revision, learning_reset_at FROM user_state_revisions/u.test(sql)) {
      return [[{ revision: 4, learning_reset_at: null }], []];
    }
    if (/SELECT id FROM review_events/u.test(sql)) return [[], []];
    if (/FROM user_collections uc[\s\S]+c\.is_default = TRUE/u.test(sql)) {
      return [[{ collection_id: 10 }], []];
    }
    if (/SELECT uc\.collection_id, uc\.last_seen_version/u.test(sql)) {
      return [[{
        collection_id: 10,
        last_seen_version: 1,
        public_id: "ielts-listening-core-1500",
        content_version: 1,
        kind: "exam"
      }], []];
    }
    if (/SELECT ce\.id AS membership_id/u.test(sql)) {
      return [[{
        membership_id: 20,
        collection_id: 10,
        vocabulary_entry_id: 30,
        introduced_version: 1,
        removed_version: null,
        removed_at: null,
        vocabulary_public_id: "vocab-monday",
        primary_form: "Monday",
        owner_user_id: null,
        collection_kind: "exam",
        section_title: "Calendar and time",
        normalized_form: "monday"
      }], []];
    }
    if (/FROM user_vocabulary_progress WHERE user_id/u.test(sql)) return [this.progress, []];
    if (/SELECT daily_new, daily_goal, voice_rate, theme FROM user_settings/u.test(sql)) {
      return [[{ daily_new: 10, daily_goal: 20, voice_rate: 0.85, theme: "system" }], []];
    }
    if (/FROM user_daily_stats WHERE user_id/u.test(sql)) return [[], []];
    if (/UPDATE user_state_revisions/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/DELETE FROM user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected SQL in efficient writer test: ${sql}`);
  }
}

class PatternPool {
  constructor(connection) {
    this.connection = connection;
    this.directCalls = [];
  }

  async execute(sql, parameters = []) {
    this.directCalls.push({ sql, parameters });
    if (/SELECT revision FROM user_state_revisions/u.test(sql)) return [[{ revision: 4 }], []];
    throw new Error(`Unexpected direct SQL: ${sql}`);
  }

  async getConnection() { return this.connection; }
}

function stateFor(word) {
  return {
    schemaVersion: 2,
    normalizedPersistenceVersion: 2,
    libraryVersions: { "ielts-listening-core-1500": 1 },
    settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" },
    words: [word],
    daily: {},
    history: [],
    persistenceCursor: { historyLength: 0, lastReviewFingerprint: null }
  };
}

describe("MySqlEfficientLearningStateRepository sparse writes", () => {
  it("does not write progress or perform per-word vocabulary lookups for untouched catalog words", async () => {
    const connection = new PatternConnection();
    const repository = new MySqlEfficientLearningStateRepository(new PatternPool(connection));

    const revision = await repository.save("7", stateFor({
      id: "vocab-monday",
      term: "Monday",
      accepted: ["Monday"],
      category: "Calendar and time",
      box: 0,
      attempts: 0,
      correct: 0,
      mistakes: 0,
      currentStreak: 0
    }), 4);

    assert.equal(revision, 5);
    assert.equal(connection.committed, true);
    assert.equal(
      connection.calls.some(({ sql }) => /(?:INSERT INTO|DELETE FROM) user_vocabulary_progress/u.test(sql)),
      false
    );
    assert.equal(
      connection.calls.some(({ sql }) => /FROM vocabulary_entries WHERE public_id/u.test(sql)),
      false,
      "catalog identity should be resolved from the single prefetched membership query"
    );
  });

  it("treats an existing default subscription row as an explicit user decision", async () => {
    const connection = new PatternConnection();
    const repository = new MySqlEfficientLearningStateRepository(new PatternPool(connection));

    await repository.save("7", stateFor({
      id: "vocab-monday",
      term: "Monday",
      accepted: ["Monday"],
      category: "Calendar and time",
      box: 0,
      attempts: 0,
      correct: 0,
      mistakes: 0,
      currentStreak: 0
    }), 4);

    const defaultProbe = connection.calls.find(({ sql }) =>
      /FROM user_collections uc[\s\S]+c\.is_default = TRUE/u.test(sql)
    );
    assert.ok(defaultProbe);
    assert.doesNotMatch(defaultProbe.sql, /uc\.status\s*=\s*'active'/u,
      "a removed default subscription must not be treated as missing and silently reactivated");
    assert.equal(
      connection.calls.some(({ sql }) => /INSERT INTO user_collections/u.test(sql)),
      false,
      "an existing default subscription row must never be re-created during state persistence"
    );
  });

  it("writes exactly one progress mutation when one prefetched word changes", async () => {
    const connection = new PatternConnection();
    const repository = new MySqlEfficientLearningStateRepository(new PatternPool(connection));

    await repository.save("7", stateFor({
      id: "vocab-monday",
      term: "Monday",
      accepted: ["Monday"],
      category: "Calendar and time",
      box: 1,
      due: "2026-08-08",
      attempts: 1,
      correct: 1,
      mistakes: 0,
      currentStreak: 1,
      introducedOn: "2026-08-07",
      lastReviewed: "2026-08-07T11:00:00.000Z"
    }), 4);

    const mutations = connection.calls.filter(({ sql }) =>
      /(?:INSERT INTO|DELETE FROM) user_vocabulary_progress/u.test(sql)
    );
    assert.equal(mutations.length, 1);
    assert.match(mutations[0].sql, /INSERT INTO user_vocabulary_progress/u);
  });
});

describe("review persistence cursor", () => {
  it("uses content rather than transient word ids for its browser/server fingerprint", () => {
    const event = {
      at: "2026-08-07T11:00:00.000Z",
      day: "2026-08-07",
      term: "Monday",
      answer: "monday",
      correct: true,
      mode: "review",
      previousBox: 1,
      newBox: 2,
      mistakeNumber: null
    };
    assert.equal(
      reviewFingerprint({ ...event, wordId: "legacy-id" }),
      reviewFingerprint({ ...event, wordId: "normalized-id" })
    );
  });
});
