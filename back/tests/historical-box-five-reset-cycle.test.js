import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function event({ id, at, correct, promoted, previousBox, newBox, term }) {
  return {
    review_event_id: id,
    occurred_at: new Date(at),
    local_day: at.slice(0, 10),
    correct,
    promoted,
    previous_box: previousBox,
    new_box: newBox,
    term_snapshot: term
  };
}

test("a final review before the latest reset to box 1 cannot master a relearned box-5 card", async () => {
  const oldFinal = event({
    id: 9500,
    at: "2026-08-01T08:00:00.000Z",
    correct: 1,
    promoted: 1,
    previousBox: 5,
    newBox: 5,
    term: "relearned"
  });
  const laterWrongReset = event({
    id: 9600,
    at: "2026-08-15T08:00:00.000Z",
    correct: 0,
    promoted: 0,
    previousBox: 5,
    newBox: 1,
    term: "relearned"
  });
  let graduated = false;

  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{ revision: 9, learning_reset_at: null }], []];
      }
      if (/FROM review_events re/u.test(sql) && /event_vocabulary/u.test(sql)) {
        return [[oldFinal, laterWrongReset], []];
      }
      if (/FROM vocabulary_entries ve/u.test(sql) && /JOIN vocabulary_forms vf/u.test(sql)) {
        return [[{ normalized_form: "relearned", vocabulary_entry_id: 501 }], []];
      }
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{
          box: 5,
          due_date: "2026-09-03",
          introduced_on: "2026-07-01",
          mastered_at: new Date("2026-08-01T08:00:00.000Z")
        }], []];
      }
      if (/FROM review_events/u.test(sql) && /vocabulary_entry_id = \?/u.test(sql)) {
        if (/correct = 0/u.test(sql) && /new_box = 1/u.test(sql)) return [[], []];
        return [[], []];
      }
      if (/SET due_date = NULL/u.test(sql)) {
        graduated = true;
        return [{ affectedRows: 1 }, []];
      }
      if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute() {
      return [[{ user_id: 31, vocabulary_entry_id: 501, forms: "relearned" }], []];
    },
    async getConnection() { return connection; }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 0, pendingCorrected: 1, repairedUsers: 1 });
  assert.equal(graduated, false, "mastery from before the later wrong reset must stay dead");
});

test("an ambiguous NULL-id reset after an exact final keeps the card pending rather than risking false mastery", async () => {
  const exactOldFinal = event({
    id: 9700,
    at: "2026-08-01T09:00:00.000Z",
    correct: 1,
    promoted: 1,
    previousBox: 5,
    newBox: 5,
    term: "shared-reset"
  });
  const ambiguousReset = event({
    id: 9800,
    at: "2026-08-15T09:00:00.000Z",
    correct: 0,
    promoted: 0,
    previousBox: 5,
    newBox: 1,
    term: "shared-reset"
  });
  let graduated = false;

  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{ revision: 10, learning_reset_at: null }], []];
      }
      if (/FROM review_events re/u.test(sql) && /event_vocabulary/u.test(sql)) {
        return [[ambiguousReset], []];
      }
      if (/FROM vocabulary_entries ve/u.test(sql) && /JOIN vocabulary_forms vf/u.test(sql)) {
        return [[
          { normalized_form: "shared-reset", vocabulary_entry_id: 601 },
          { normalized_form: "shared-reset", vocabulary_entry_id: 602 }
        ], []];
      }
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{
          box: 5,
          due_date: "2026-09-03",
          introduced_on: "2026-07-01",
          mastered_at: new Date("2026-08-01T09:00:00.000Z")
        }], []];
      }
      if (/FROM review_events/u.test(sql) && /vocabulary_entry_id = \?/u.test(sql)) {
        if (/correct = 0/u.test(sql) && /new_box = 1/u.test(sql)) return [[], []];
        if (/correct = 1/u.test(sql) && /previous_box = 5/u.test(sql)) return [[exactOldFinal], []];
      }
      if (/SET due_date = NULL/u.test(sql)) {
        graduated = true;
        return [{ affectedRows: 1 }, []];
      }
      if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute() {
      return [[{ user_id: 32, vocabulary_entry_id: 601, forms: "shared-reset" }], []];
    },
    async getConnection() { return connection; }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 0, pendingCorrected: 1, repairedUsers: 1 });
  assert.equal(graduated, false, "uncertain reset ownership must never cause an automatic false mastery");
});
