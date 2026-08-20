import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function review(id, at, previousBox, term = null) {
  return {
    review_event_id: id,
    occurred_at: new Date(at),
    local_day: at.slice(0, 10),
    correct: 1,
    promoted: 1,
    previous_box: previousBox,
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

test("an exact review wins when it is newer than trusted fallback evidence", async () => {
  const calls = [];
  const exactFinal = review(7001, "2026-08-20T08:00:00.000Z", 5);
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) return [[{ revision: 3, learning_reset_at: null }], []];
      if (isFallbackEvidenceQuery(sql)) return [[review(6999, "2026-08-19T08:00:00.000Z", 4, "legacy-term")], []];
      if (isOwnerQuery(sql)) return [[{ normalized_form: "legacy-term", vocabulary_entry_id: 501 }], []];
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) return [[{ box: 5, due_date: "2026-09-03", mastered_at: null }], []];
      if (isExactQuery(sql)) return [[exactFinal], []];
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const result = await repairHistoricalBoxFiveProgress(basePool(connection));
  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = calls.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.equal(graduation.parameters[0].toISOString(), "2026-08-20T08:00:00.000Z");
});

test("a newer trusted fallback final review supersedes an older exact box-5 entry", async () => {
  const calls = [];
  const exactEntry = review(7100, "2026-08-06T08:00:00.000Z", 4);
  const fallbackFinal = review(7200, "2026-08-20T08:00:00.000Z", 5, "legacy-term");
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) return [[{ revision: 4, learning_reset_at: null }], []];
      if (isFallbackEvidenceQuery(sql)) return [[fallbackFinal], []];
      if (isOwnerQuery(sql)) return [[{ normalized_form: "legacy-term", vocabulary_entry_id: 501 }], []];
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) return [[{ box: 5, due_date: "2026-09-03", mastered_at: null }], []];
      if (isExactQuery(sql)) return [[exactEntry], []];
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const result = await repairHistoricalBoxFiveProgress(basePool(connection));
  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = calls.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.ok(graduation, "newer trusted fallback final review must graduate the card");
  assert.equal(graduation.parameters[0].toISOString(), "2026-08-20T08:00:00.000Z");
});
