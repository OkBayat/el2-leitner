import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

test("an exact vocabulary review is authoritative before any term fallback", async () => {
  const calls = [];
  const exactFinal = {
    review_event_id: 7001,
    occurred_at: new Date("2026-08-20T08:00:00.000Z"),
    local_day: "2026-08-20",
    correct: 1,
    promoted: 1,
    previous_box: 5,
    new_box: 5
  };

  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{ revision: 3, learning_reset_at: null }], []];
      }
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{ box: 5, due_date: "2026-09-03", mastered_at: null }], []];
      }
      if (/FROM review_events/u.test(sql)) {
        assert.doesNotMatch(sql, /term_snapshot/u, "fallback matching must not be mixed into the exact-id query");
        assert.match(sql, /vocabulary_entry_id = \?/u, "exact lookup must use the indexed vocabulary identity");
        return [[exactFinal], []];
      }
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute(sql) {
      assert.match(sql, /GROUP_CONCAT/u);
      return [[{
        user_id: 21,
        vocabulary_entry_id: 501,
        forms: "authoritative-term\u001flegacy-term"
      }], []];
    },
    async getConnection() { return connection; }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  assert.equal(calls.filter(({ sql }) => /FROM review_events/u.test(sql)).length, 1);
  assert.ok(calls.some(({ sql }) => /SET due_date = NULL/u.test(sql)));
});
