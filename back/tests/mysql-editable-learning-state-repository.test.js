import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MySqlEditableLearningStateRepository,
  applyVocabularyOverrides,
  restoreCanonicalVocabularyForms
} from "../src/infrastructure/persistence/mysql/MySqlEditableLearningStateRepository.js";
import { MySqlEditableLearningBootstrapRepository } from "../src/infrastructure/persistence/mysql/MySqlEditableLearningBootstrapRepository.js";

class EditConnection {
  constructor() {
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
    if (/SELECT revision FROM user_state_revisions[\s\S]+FOR UPDATE/u.test(sql)) {
      return [[{ revision: 12 }], []];
    }
    if (/FROM vocabulary_entries ve[\s\S]+JOIN collection_entries/u.test(sql)) {
      return [[{ id: 30, public_id: "vocab-1" }], []];
    }
    if (/INSERT INTO user_vocabulary_overrides/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/UPDATE user_state_revisions/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected edit SQL: ${sql}`);
  }
}

class EditPool {
  constructor(connection = new EditConnection()) {
    this.connection = connection;
    this.calls = [];
  }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT revision FROM user_state_revisions/u.test(sql)) return [[{ revision: 12 }], []];
    throw new Error(`Unexpected direct edit SQL: ${sql}`);
  }
  async getConnection() { return this.connection; }
}

class BootstrapPool {
  constructor() { this.calls = []; }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT revision, state_created_at/u.test(sql)) {
      return [[{
        revision: 13,
        state_created_at: new Date("2026-09-01T00:00:00.000Z"),
        metadata_json: JSON.stringify({ schemaVersion: 2 }),
        learning_reset_at: null,
        created_at: new Date("2026-09-01T00:00:00.000Z"),
        updated_at: new Date("2026-09-02T00:00:00.000Z")
      }], []];
    }
    if (/SELECT daily_new, daily_goal/u.test(sql)) {
      return [[{ daily_new: 10, daily_goal: 20, voice_rate: 0.85, theme: "system" }], []];
    }
    if (/FROM user_daily_stats/u.test(sql)) return [[], []];
    if (/SELECT ve\.public_id, ve\.primary_form/u.test(sql) && /FROM user_collections/u.test(sql)) {
      return [[{
        public_id: "vocab-1",
        primary_form: "circumstance",
        accepted_forms: "circumstance",
        source_priority: 0,
        source_subscribed_at: new Date("2026-09-01T00:00:00.000Z"),
        source_position: 1,
        category: "Discussion",
        lessons: "Discussion",
        tags: null,
        personal_note: "plural preferred",
        box: 1,
        due_date: "2099-01-01",
        attempts: 0,
        correct_count: 0,
        mistake_count: 0,
        current_streak: 0,
        introduced_on: "2026-09-01",
        introduced_via: "daily",
        last_reviewed_at: null,
        last_promoted_on: null,
        blocked_until: null,
        mastered_at: null,
        progress_created_at: new Date("2026-09-01T00:00:00.000Z")
      }], []];
    }
    if (/FROM review_events/u.test(sql)) return [[], []];
    if (/SELECT c\.public_id, c\.content_version/u.test(sql)) {
      return [[{ public_id: "ielts", content_version: 1 }], []];
    }
    if (/FROM user_vocabulary_overrides uvo/u.test(sql)) {
      return [[{
        public_id: "vocab-1",
        primary_form: "circumstances",
        accepted_forms_json: JSON.stringify(["circumstances", "circumstance"])
      }], []];
    }
    throw new Error(`Unexpected bootstrap SQL: ${sql}`);
  }
}

describe("user vocabulary overrides", () => {
  it("overlays edited spelling forms without changing the canonical vocabulary identity", () => {
    const state = { words: [{ id: "vocab-1", term: "circumstance", accepted: ["circumstance"] }] };
    applyVocabularyOverrides(state, [{
      public_id: "vocab-1",
      primary_form: "circumstances",
      accepted_forms_json: JSON.stringify(["circumstances", "circumstance"])
    }]);
    assert.deepEqual(state.words[0], {
      id: "vocab-1",
      term: "circumstances",
      accepted: ["circumstances", "circumstance"]
    });
  });

  it("restores canonical forms before compatibility full-state saves so an override cannot fork public vocabulary", () => {
    const state = { words: [{ id: "vocab-1", term: "circumstances", accepted: ["circumstances"] }] };
    restoreCanonicalVocabularyForms(state, [{
      public_id: "vocab-1",
      primary_form: "circumstance",
      accepted_forms: "circumstance"
    }]);
    assert.deepEqual(state.words[0], {
      id: "vocab-1",
      term: "circumstance",
      accepted: ["circumstance"]
    });
  });

  it("persists one edit transactionally and increments the optimistic revision", async () => {
    const pool = new EditPool();
    const repository = new MySqlEditableLearningStateRepository(pool);

    const revision = await repository.updateVocabulary("7", {
      id: "vocab-1",
      term: "circumstances",
      accepted: ["circumstances", "circumstance"],
      category: "Discussion",
      notes: "plural preferred"
    }, 12);

    assert.equal(revision, 13);
    assert.equal(pool.connection.committed, true);
    const overrideWrite = pool.connection.calls.find(({ sql }) => /INSERT INTO user_vocabulary_overrides/u.test(sql));
    assert.ok(overrideWrite);
    assert.deepEqual(overrideWrite.parameters, [
      "7", 30, "circumstances", JSON.stringify(["circumstances", "circumstance"])
    ]);
    const progressWrite = pool.connection.calls.find(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql));
    assert.ok(progressWrite);
    assert.deepEqual(progressWrite.parameters, ["7", 30, "plural preferred", "Discussion"]);
    const revisionWrite = pool.connection.calls.find(({ sql }) => /UPDATE user_state_revisions/u.test(sql));
    assert.deepEqual(revisionWrite.parameters, [13, "7"]);
  });

  it("projects the persisted override through the default bootstrap read used after page refresh", async () => {
    const repository = new MySqlEditableLearningBootstrapRepository(new BootstrapPool(), {
      async findByUserId() { throw new Error("fallback should not run"); }
    });

    const result = await repository.findByUserId("7");

    assert.equal(result.revision, 13);
    assert.equal(result.state.words[0].id, "vocab-1");
    assert.equal(result.state.words[0].term, "circumstances");
    assert.deepEqual(result.state.words[0].accepted, ["circumstances", "circumstance"]);
    assert.equal(result.state.words[0].notes, "plural preferred");
  });
});
