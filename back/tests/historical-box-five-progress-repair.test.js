import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function candidate(userId, vocabularyEntryId, forms = []) {
  return {
    user_id: userId,
    vocabulary_entry_id: vocabularyEntryId,
    forms: forms.join("\u001f")
  };
}

function progress(masteredAt) {
  return {
    box: 5,
    due_date: "2026-09-03",
    mastered_at: masteredAt ? new Date(masteredAt) : null
  };
}

function finalReview(id, at, day = "2026-08-20") {
  return {
    review_event_id: id,
    occurred_at: new Date(at),
    local_day: day,
    correct: 1,
    promoted: 1,
    previous_box: 5,
    new_box: 5
  };
}

describe("historical box-five progress repair", () => {
  it("locks the learner revision before progress and repairs exact-id final/pending cards once", async () => {
    const writes = [];
    const candidates = [
      candidate(7, 101, ["graduated"]),
      candidate(7, 102, ["pending"])
    ];
    const progressById = new Map([
      [101, progress("2026-08-01T09:00:00.000Z")],
      [102, progress("2026-08-18T08:00:00.000Z")]
    ]);
    const eventsById = new Map([
      [101, finalReview(9001, "2026-08-20T08:00:00.000Z")],
      [102, {
        review_event_id: 9002,
        occurred_at: new Date("2026-08-18T08:00:00.000Z"),
        local_day: "2026-08-18",
        correct: 1,
        promoted: 1,
        previous_box: 4,
        new_box: 5
      }]
    ]);

    const connection = {
      async beginTransaction() { writes.push({ sql: "BEGIN", parameters: [] }); },
      async commit() { writes.push({ sql: "COMMIT", parameters: [] }); },
      async rollback() {},
      release() {},
      async execute(sql, parameters = []) {
        writes.push({ sql, parameters });
        if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[{ revision: 12, learning_reset_at: null }], []];
        }
        if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[progressById.get(Number(parameters[1]))], []];
        }
        if (/FROM review_events/u.test(sql) && /ORDER BY occurred_at DESC/u.test(sql)) {
          return [[eventsById.get(Number(parameters[3]))], []];
        }
        if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };

    const pool = {
      async execute(sql) {
        assert.match(sql, /uvp\.box = 5/u);
        assert.match(sql, /uvp\.due_date IS NOT NULL/u);
        assert.match(sql, /GROUP_CONCAT/u, "candidate discovery must include accepted forms for alias fallback");
        return [candidates, []];
      },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 1, pendingCorrected: 1, repairedUsers: 1 });

    const transactionalSql = writes
      .filter(({ sql }) => !["BEGIN", "COMMIT"].includes(sql))
      .map(({ sql }) => sql);
    assert.match(transactionalSql[0], /user_state_revisions/u, "revision must be the first row lock to match normal write-path lock order");
    assert.match(transactionalSql[0], /FOR UPDATE/u);
    assert.match(transactionalSql[1], /user_vocabulary_progress/u);
    assert.match(transactionalSql[1], /FOR UPDATE/u);

    const graduation = writes.find(({ sql }) => /SET due_date = NULL/u.test(sql));
    assert.ok(graduation);
    assert.equal(graduation.parameters[0].toISOString(), "2026-08-20T08:00:00.000Z");
    assert.equal(graduation.parameters[1].toISOString(), "2026-08-20T08:00:00.000Z");
    assert.equal(graduation.parameters[2], "2026-08-20");
    assert.equal(graduation.parameters[3], 7);
    assert.equal(graduation.parameters[4], 101);

    const pendingCorrection = writes.find(({ sql }) => /SET mastered_at = NULL/u.test(sql));
    assert.ok(pendingCorrection);
    assert.deepEqual(pendingCorrection.parameters, [7, 102]);

    const revisionWrites = writes.filter(({ sql }) => /SET revision = revision \+ 1/u.test(sql));
    assert.equal(revisionWrites.length, 1);
    assert.deepEqual(revisionWrites[0].parameters, [7]);
  });

  it("finds a historical final review by accepted term when its old vocabulary id is retired or null", async () => {
    const writes = [];
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async execute(sql, parameters = []) {
        writes.push({ sql, parameters });
        if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[{ revision: 4, learning_reset_at: null }], []];
        }
        if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[progress("2026-08-01T09:00:00.000Z")], []];
        }
        if (/FROM review_events/u.test(sql) && /ORDER BY occurred_at DESC/u.test(sql)) {
          assert.match(sql, /term_snapshot IN/u, "retired/null event ids need an accepted-form fallback");
          assert.ok(parameters.includes("center"));
          assert.ok(parameters.includes("centre"));
          return [[finalReview(9100, "2026-08-20T08:30:00.000Z")], []];
        }
        if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(9, 201, ["center", "centre"])], []]; },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
    assert.ok(writes.some(({ sql }) => /SET due_date = NULL/u.test(sql)));
  });

  it("does nothing when no stuck box-five rows exist", async () => {
    let connectionRequested = false;
    const pool = {
      async execute(sql) {
        assert.match(sql, /box = 5/u);
        assert.match(sql, /due_date IS NOT NULL/u);
        return [[], []];
      },
      async getConnection() {
        connectionRequested = true;
        throw new Error("no transaction should be opened");
      }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 0, pendingCorrected: 0, repairedUsers: 0 });
    assert.equal(connectionRequested, false);
  });
});
