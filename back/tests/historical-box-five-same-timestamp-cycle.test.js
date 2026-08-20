import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function review({ id, correct, promoted, previousBox, newBox }) {
  return {
    review_event_id: id,
    occurred_at: new Date("2026-08-15T10:00:00.000Z"),
    local_day: "2026-08-15",
    correct,
    promoted,
    previous_box: previousBox,
    new_box: newBox,
    term_snapshot: "same timestamp"
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

function isExactResetQuery(sql) {
  return /FROM review_events/u.test(sql) && /correct = 0/u.test(sql) && /new_box = 1/u.test(sql);
}

function isExactFinalQuery(sql) {
  return /FROM review_events/u.test(sql) && /correct = 1/u.test(sql) && /previous_box = 5/u.test(sql);
}

test("an exact final with the same timestamp but a later event id survives the reset boundary", async () => {
  const reset = review({ id: 100, correct: 0, promoted: 0, previousBox: 5, newBox: 1 });
  const final = review({ id: 101, correct: 1, promoted: 1, previousBox: 5, newBox: 5 });
  const writes = [];

  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, parameters = []) {
      writes.push({ sql, parameters });
      if (isRevisionLock(sql)) return [[{ revision: 12, learning_reset_at: null }], []];
      if (isFallbackEvidenceQuery(sql)) return [[], []];
      if (/FROM learning_states/u.test(sql)) return [[], []];
      if (isOwnerQuery(sql)) return [[{ normalized_form: "same timestamp", vocabulary_entry_id: 801 }], []];
      if (isProgressLock(sql)) {
        return [[{
          box: 5,
          due_date: "2026-09-03",
          introduced_on: "2026-07-01",
          mastered_at: new Date("2026-08-01T10:00:00.000Z")
        }], []];
      }
      if (isExactResetQuery(sql)) return [[reset], []];
      if (isExactFinalQuery(sql)) {
        assert.match(
          sql,
          /occurred_at > \?\s+OR \(occurred_at = \? AND id > \?\)/u,
          "the exact final query must break a timestamp tie with the review event id"
        );
        assert.equal(parameters.at(-1), 100, "the reset event id must be part of the exact final boundary");
        return [[final], []];
      }
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute() {
      return [[{ user_id: 51, vocabulary_entry_id: 801, forms: "same timestamp" }], []];
    },
    async getConnection() {
      return connection;
    }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = writes.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.ok(graduation);
  assert.equal(graduation.parameters[0].toISOString(), "2026-08-15T10:00:00.000Z");
});
