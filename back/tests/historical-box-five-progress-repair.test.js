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

function review({ id, at, previousBox, newBox = 5, correct = 1, promoted = 1 }) {
  return {
    review_event_id: id,
    occurred_at: new Date(at),
    local_day: at.slice(0, 10),
    correct,
    promoted,
    previous_box: previousBox,
    new_box: newBox
  };
}

function isExactReviewQuery(sql) {
  return /FROM review_events/u.test(sql) && !/term_snapshot/u.test(sql);
}

function isFallbackReviewQuery(sql) {
  return /FROM review_events re/u.test(sql) && /term_snapshot/u.test(sql);
}

describe("historical box-five progress repair", () => {
  it("locks revision before progress and repairs exact final/pending cards once", async () => {
    const writes = [];
    const progressById = new Map([
      [101, progress("2026-08-01T09:00:00.000Z")],
      [102, progress("2026-08-18T08:00:00.000Z")]
    ]);
    const exactById = new Map([
      [101, review({ id: 9001, at: "2026-08-20T08:00:00.000Z", previousBox: 5 })],
      [102, review({ id: 9002, at: "2026-08-18T08:00:00.000Z", previousBox: 4 })]
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
        if (isExactReviewQuery(sql)) return [[exactById.get(Number(parameters[3]))], []];
        if (isFallbackReviewQuery(sql)) return [[], []];
        if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };

    const pool = {
      async execute(sql) {
        assert.match(sql, /JOIN user_state_revisions/u, "orphan progress must not enter startup repair");
        assert.match(sql, /uvp\.box = 5/u);
        assert.match(sql, /uvp\.due_date IS NOT NULL/u);
        assert.match(sql, /vf\.normalized_form/u, "candidate aliases must use canonical normalization");
        return [[candidate(7, 101, ["graduated"]), candidate(7, 102, ["pending"])], []];
      },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 1, pendingCorrected: 1, repairedUsers: 1 });

    const transactionalSql = writes.filter(({ sql }) => !["BEGIN", "COMMIT"].includes(sql)).map(({ sql }) => sql);
    assert.match(transactionalSql[0], /user_state_revisions/u);
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
    assert.equal(writes.filter(({ sql }) => /SET revision = revision \+ 1/u.test(sql)).length, 1);
  });

  it("uses normalized accepted-term fallback when exact review is absent", async () => {
    const writes = [];
    let exactLookups = 0;
    let fallbackLookups = 0;
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
        if (isExactReviewQuery(sql)) {
          exactLookups += 1;
          return [[], []];
        }
        if (isFallbackReviewQuery(sql)) {
          fallbackLookups += 1;
          assert.match(sql, /REGEXP_REPLACE/u, "legacy snapshots must normalize whitespace/punctuation");
          assert.match(sql, /ambiguous_form\.normalized_form/u);
          assert.ok(parameters.includes("center"));
          assert.ok(parameters.includes("centre"));
          return [[review({ id: 9100, at: "2026-08-20T08:30:00.000Z", previousBox: 5 })], []];
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
    assert.equal(exactLookups, 1);
    assert.equal(fallbackLookups, 1);
    assert.ok(writes.some(({ sql }) => /SET due_date = NULL/u.test(sql)));
  });

  it("never steals a same-term review that belongs to another active identity", async () => {
    const writes = [];
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async execute(sql, parameters = []) {
        writes.push({ sql, parameters });
        if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[{ revision: 6, learning_reset_at: null }], []];
        }
        if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[progress("2026-08-01T09:00:00.000Z")], []];
        }
        if (isExactReviewQuery(sql)) return [[], []];
        if (isFallbackReviewQuery(sql)) {
          assert.match(sql, /LEFT JOIN vocabulary_entries event_vocabulary/u);
          assert.match(sql, /event_vocabulary\.status <> 'active'/u);
          assert.match(sql, /re\.vocabulary_entry_id IS NULL/u);
          return [[], []];
        }
        if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(11, 301, ["reused-term"])], []]; },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 0, pendingCorrected: 1, repairedUsers: 1 });
    assert.equal(writes.some(({ sql }) => /SET due_date = NULL/u.test(sql)), false);
  });

  it("does not claim a null-id review when its normalized term is ambiguous", async () => {
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async execute(sql, parameters = []) {
        if (/FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[{ revision: 8, learning_reset_at: null }], []];
        }
        if (/FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql)) {
          return [[progress("2026-08-01T09:00:00.000Z")], []];
        }
        if (isExactReviewQuery(sql)) return [[], []];
        if (isFallbackReviewQuery(sql)) {
          assert.match(sql, /NOT EXISTS/u);
          assert.match(sql, /ambiguous_form\.normalized_form/u);
          assert.match(sql, /ambiguous_vocabulary\.owner_user_id/u);
          return [[], []];
        }
        if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(13, 401, ["shared-term"])], []]; },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 0, pendingCorrected: 1, repairedUsers: 1 });
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
