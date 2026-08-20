import assert from "node:assert/strict";
import { test } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

const finalAt = "2026-08-20T10:00:00.006Z";

function preservedState() {
  return {
    schemaVersion: 2,
    words: [{
      id: "legacy-monday-id",
      term: "Monday",
      box: 5,
      due: "2026-09-03",
      introducedOn: "2026-07-12",
      masteredAt: "2026-08-20T10:00:00.003Z"
    }],
    history: [
      {
        at: "2026-08-06T17:12:27.997Z",
        day: "2026-08-06",
        wordId: "legacy-monday-id",
        term: "Monday",
        correct: true,
        promoted: true,
        previousBox: 4,
        newBox: 5
      },
      {
        at: finalAt,
        day: "2026-08-20",
        wordId: "legacy-monday-id",
        term: "Monday",
        correct: true,
        promoted: true,
        previousBox: 5,
        newBox: 5
      }
    ]
  };
}

test("preserved learning_states history repairs a final review missing from normalized review_events", async () => {
  const writes = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, parameters = []) {
      writes.push({ sql, parameters });

      if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{ revision: 20, learning_reset_at: null }], []];
      }
      if (/FROM review_events re/u.test(sql) && /event_vocabulary/u.test(sql)) {
        return [[], []];
      }
      if (/FROM learning_states/u.test(sql)) {
        assert.deepEqual(parameters, [77]);
        return [[{ state_json: JSON.stringify(preservedState()) }], []];
      }
      if (/FROM vocabulary_entries ve/u.test(sql) && /JOIN vocabulary_forms vf/u.test(sql)) {
        return [[{ normalized_form: "monday", vocabulary_entry_id: 501 }], []];
      }
      if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
        return [[{
          box: 5,
          due_date: "2026-09-03",
          introduced_on: "2026-07-12",
          mastered_at: null
        }], []];
      }
      if (/FROM review_events/u.test(sql) && /vocabulary_entry_id = \?/u.test(sql)) {
        return [[], []];
      }
      if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async execute(sql) {
      assert.match(sql, /uvp\.box = 5/u);
      return [[{
        user_id: 77,
        vocabulary_entry_id: 501,
        forms: "monday"
      }], []];
    },
    async getConnection() {
      return connection;
    }
  };

  const result = await repairHistoricalBoxFiveProgress(pool);

  assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
  const graduation = writes.find(({ sql }) => /SET due_date = NULL/u.test(sql));
  assert.ok(graduation, "the preserved final review must graduate the normalized card");
  assert.equal(graduation.parameters[0].toISOString(), finalAt);
  assert.equal(graduation.parameters[3], "2026-08-20");
  assert.deepEqual(graduation.parameters.slice(4), [77, 501]);
  assert.equal(writes.filter(({ sql }) => /SET revision = revision \+ 1/u.test(sql)).length, 1);
});
