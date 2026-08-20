import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function finalReview() {
  return {
    review_event_id: 9900,
    occurred_at: new Date("2026-08-20T09:30:00.000Z"),
    local_day: "2026-08-20",
    correct: 1,
    promoted: 1,
    previous_box: 5,
    new_box: 5,
    term_snapshot: "legacy orphan"
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

test("an active but no-longer-visible legacy identity can supply the real final review", async () => {
  const writes = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, parameters = []) {
      writes.push({ sql, parameters });
      if (isRevisionLock(sql)) {
        return [[{ revision: 17, learning_reset_at: null }], []];
      }
      if (isFallbackEvidenceQuery(sql)) {
        assert.match(
          sql,
          /NOT EXISTS\s*\([\s\S]*FROM user_collections[\s\S]*ce\.vocabulary_entry_id = event_vocabulary\.id/u,
          "an event linked to an active orphan identity must remain eligible as historical fallback evidence"
        );
        assert.equal(
          parameters.at(-1),
          44,
          "fallback visibility must be scoped to the learner whose card is being repaired"
        );
        return [[finalReview()], []];
      }
      if (/FROM learning_states/u.test(sql)) return [[], []];
      if (isOwnerQuery(sql)) {
        assert.match(
          sql,
          /EXISTS\s*\([\s\S]*FROM user_collections[\s\S]*ce\.vocabulary_entry_id = ve\.id/u,
          "only identities currently visible through an active collection may make a fallback ambiguous"
        );
        return [[{ normalized_form: "legacy orphan", vocabulary_entry_id: 701 }], []];
      }
      if (isProgressLock(sql)) {
        return [[{
          box: 5,
          due_date: "2026-09-03",
          introduced_on: "2026-07-01",
          mastered_at: new Date("2026-08-01T09:30:00.000Z")
        }], []];
      }
      if (isExactReviewQuery(sql)) return [[], []];
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute(sql) {
      assert.match(sql, /GROUP_CONCAT/u);
      return [[{
        user_id: 44,
        vocabulary_entry_id: 701,
        forms: "legacy orphan"
      }], []];
    },
    async getConnection() {
      return connection;
    }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = writes.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.ok(graduation, "the current canonical card must graduate from the orphan identity's real final review");
  assert.equal(graduation.parameters[0].toISOString(), "2026-08-20T09:30:00.000Z");
});
