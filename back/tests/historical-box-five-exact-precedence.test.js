import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function review(id, at, term = null) {
  return {
    review_event_id: id,
    occurred_at: new Date(at),
    local_day: at.slice(0, 10),
    correct: 1,
    promoted: 1,
    previous_box: 5,
    new_box: 5,
    ...(term === null ? {} : { term_snapshot: term })
  };
}

function isFallbackEvidenceQuery(sql) {
  return /FROM review_events re/u.test(sql) && /event_vocabulary/u.test(sql);
}
function isOwnerQuery(sql) {
  return /FROM vocabulary_entries ve/u.test(sql) && /JOIN vocabulary_forms vf/u.test(sql);
}
function isExactQuery(sql) {
  return /FROM review_events/u.test(sql) && /vocabulary_entry_id = \?/u.test(sql) && !/event_vocabulary/u.test(sql);
}

function basePool(connection, forms = "authoritative-term\u001flegacy-term") {
  return {
    async execute(sql) {
      assert.match(sql, /GROUP_CONCAT/u);
      return [[{ user_id: 21, vocabulary_entry_id: 501, forms }], []];
    },
    async getConnection() { return connection; }
  };
}

function progress() {
  return [{ box: 5, due_date: "2026-09-03", introduced_on: "2026-07-01", mastered_at: null }];
}

test("the earliest exact final review beats a later trusted fallback final", async () => {
  const calls = [];
  const exactFinal = review(7001, "2026-08-06T08:00:00.000Z");
  const fallbackFinal = review(7100, "2026-08-20T08:00:00.000Z", "legacy-term");
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) return [[{ revision: 3, learning_reset_at: null }], []];
      if (isFallbackEvidenceQuery(sql)) return [[fallbackFinal], []];
      if (isOwnerQuery(sql)) return [[{ normalized_form: "legacy-term", vocabulary_entry_id: 501 }], []];
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) return [progress(), []];
      if (isExactQuery(sql)) {
        assert.match(sql, /correct = 1/u);
        assert.match(sql, /promoted = 1/u);
        assert.match(sql, /previous_box = 5/u);
        assert.match(sql, /new_box = 5/u);
        assert.match(sql, /local_day >= \?/u);
        assert.match(sql, /ORDER BY occurred_at ASC, id ASC/u);
        return [[exactFinal], []];
      }
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const result = await repairHistoricalBoxFiveProgress(basePool(connection));
  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = calls.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.equal(graduation.parameters[0].toISOString(), "2026-08-06T08:00:00.000Z");
});

test("the earliest trusted fallback final beats a later exact final review", async () => {
  const calls = [];
  const fallbackFinal = review(7200, "2026-08-06T08:00:00.000Z", "legacy-term");
  const exactFinal = review(7300, "2026-08-20T08:00:00.000Z");
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) return [[{ revision: 4, learning_reset_at: null }], []];
      if (isFallbackEvidenceQuery(sql)) return [[fallbackFinal], []];
      if (isOwnerQuery(sql)) return [[{ normalized_form: "legacy-term", vocabulary_entry_id: 501 }], []];
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) return [progress(), []];
      if (isExactQuery(sql)) return [[exactFinal], []];
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const result = await repairHistoricalBoxFiveProgress(basePool(connection));
  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = calls.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.ok(graduation, "the earlier trusted fallback final must graduate the card");
  assert.equal(graduation.parameters[0].toISOString(), "2026-08-06T08:00:00.000Z");
});
