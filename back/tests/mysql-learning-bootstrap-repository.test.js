import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlLearningBootstrapRepository } from "../src/infrastructure/persistence/mysql/MySqlLearningBootstrapRepository.js";

class BootstrapPool {
  constructor() {
    this.calls = [];
  }

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/FROM user_state_revisions/u.test(sql)) {
      return [[{
        revision: 42,
        state_created_at: "2026-07-12T00:00:00.000Z",
        metadata_json: JSON.stringify({ schemaVersion: 2 }),
        learning_reset_at: null,
        created_at: "2026-07-12T00:00:00.000Z",
        updated_at: "2026-08-16T14:00:00.000Z"
      }], []];
    }
    if (/FROM user_settings/u.test(sql)) {
      return [[{ daily_new: 10, daily_goal: 20, voice_rate: 0.85, theme: "light" }], []];
    }
    if (/FROM user_daily_stats/u.test(sql)) {
      return [[{
        day: "2026-08-16",
        attempts: 3,
        correct_count: 2,
        wrong_count: 1,
        new_added: 10,
        session_count: 1,
        duration_seconds: 60
      }], []];
    }
    if (/GROUP_CONCAT/u.test(sql)) {
      return [[{
        public_id: "vocab-1",
        primary_form: "roommate",
        accepted_forms: "roommate",
        category: "People",
        personal_note: null,
        box: 0,
        due_date: null,
        attempts: 0,
        correct_count: 0,
        mistake_count: 0,
        current_streak: 0,
        introduced_on: null,
        introduced_via: null,
        last_reviewed_at: null,
        last_promoted_on: null,
        blocked_until: null,
        mastered_at: null,
        progress_created_at: "2026-08-07T12:00:00.000Z"
      }], []];
    }
    if (/FROM review_events/u.test(sql)) {
      return [[{
        occurred_at: "2026-08-16T13:59:00.000Z",
        local_day: "2026-08-16",
        answer: "roommate",
        correct: 1,
        mode: "scheduled",
        previous_box: 1,
        new_box: 2,
        promoted: 1,
        mistake_number: null,
        term_snapshot: "roommate",
        vocabulary_public_id: "vocab-1"
      }], []];
    }
    if (/SELECT c\.public_id, c\.content_version/u.test(sql)) {
      return [[{ public_id: "ielts", content_version: 3 }], []];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

describe("MySqlLearningBootstrapRepository", () => {
  it("returns compact words and only the latest history event", async () => {
    const pool = new BootstrapPool();
    const fallback = { findByUserId: async () => { throw new Error("fallback should not run"); } };
    const repository = new MySqlLearningBootstrapRepository(pool, fallback);

    const result = await repository.findByUserId(7);

    assert.equal(result.revision, 42);
    assert.equal(result.state.history.length, 1);
    assert.equal(result.state.words.length, 1);
    assert.deepEqual(result.state.words[0], {
      id: "vocab-1",
      number: 1,
      term: "roommate",
      accepted: ["roommate"],
      category: "People",
      notes: "",
      createdAt: "2026-08-07T12:00:00.000Z"
    });
    assert.equal(result.state.persistenceCursor.historyLength, 1);
    assert.ok(result.state.persistenceCursor.lastReviewFingerprint);
    const historyQuery = pool.calls.find(({ sql }) => /FROM review_events/u.test(sql));
    assert.match(historyQuery.sql, /ORDER BY re\.occurred_at DESC, re\.id DESC\s+LIMIT 1/u);
    assert.equal(pool.calls.some(({ sql }) => /LIMIT 20000/u.test(sql)), false);
    const wordQuery = pool.calls.find(({ sql }) => /GROUP_CONCAT/u.test(sql));
    assert.match(wordQuery.sql, /MIN\(ve\.created_at\) AS progress_created_at/u);
    assert.doesNotMatch(wordQuery.sql, /uvp\.created_at/u,
      "bootstrap createdAt must not drift when a progress row is created");
  });
});
