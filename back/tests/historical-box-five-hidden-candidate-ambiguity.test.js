import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function candidate(vocabularyEntryId) {
  return {
    user_id: 61,
    vocabulary_entry_id: vocabularyEntryId,
    forms: "hidden shared alias"
  };
}

function finalReview() {
  return {
    review_event_id: 1100,
    occurred_at: new Date("2026-08-20T11:00:00.000Z"),
    local_day: "2026-08-20",
    correct: 1,
    promoted: 1,
    previous_box: 5,
    new_box: 5,
    term_snapshot: "hidden shared alias"
  };
}

function isRevisionLock(sql) {
  return /FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql);
}

function isProgressLock(sql) {
  return /FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql);
}

function isFallbackEvidenceQuery(sql) {
  return /FROM review_events re/u.test(sql) && /event_vocabulary/u.test(sql);
}

function isOwnerQuery(sql) {
  return /FROM vocabulary_entries ve/u.test(sql) && /JOIN vocabulary_forms vf/u.test(sql);
}

function isExactReviewQuery(sql) {
  return /FROM review_events/u.test(sql) && /vocabulary_entry_id = \?/u.test(sql) && !/event_vocabulary/u.test(sql);
}

test("two hidden candidate identities keep a shared fallback ambiguous regardless of row order", async () => {
  let graduated = 0;
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (isRevisionLock(sql)) return [[{ revision: 20, learning_reset_at: null }], []];
      if (isFallbackEvidenceQuery(sql)) return [[finalReview()], []];
      if (/FROM learning_states/u.test(sql)) return [[], []];
      if (isOwnerQuery(sql)) return [[], []];
      if (isProgressLock(sql)) {
        return [[{
          box: 5,
          due_date: "2026-09-03",
          introduced_on: "2026-07-01",
          mastered_at: new Date("2026-08-01T11:00:00.000Z")
        }], []];
      }
      if (isExactReviewQuery(sql)) return [[], []];
      if (/SET due_date = NULL/u.test(sql)) {
        graduated += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute() {
      return [[candidate(901), candidate(902)], []];
    },
    async getConnection() {
      return connection;
    }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 0, pendingCorrected: 2, repairedUsers: 1 });
  assert.equal(graduated, 0, "a fallback with two hidden candidate owners must remain unclaimed");
});
