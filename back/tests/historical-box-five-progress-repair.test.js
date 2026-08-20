import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";

function candidate(userId, vocabularyEntryId, forms = []) {
  return { user_id: userId, vocabulary_entry_id: vocabularyEntryId, forms: forms.join("\u001f") };
}

function progress(masteredAt, introducedOn = "2026-07-01") {
  return {
    box: 5,
    due_date: "2026-09-03",
    introduced_on: introducedOn,
    mastered_at: masteredAt ? new Date(masteredAt) : null
  };
}

function review({ id, at, previousBox, term = null, newBox = 5, correct = 1, promoted = 1 }) {
  return {
    review_event_id: id,
    occurred_at: new Date(at),
    local_day: at.slice(0, 10),
    correct,
    promoted,
    previous_box: previousBox,
    new_box: newBox,
    ...(term === null ? {} : { term_snapshot: term })
  };
}

function isRevisionLock(sql) {
  return /FROM user_state_revisions/u.test(sql) && /FOR UPDATE/u.test(sql);
}
function isProgressLock(sql) {
  return /FROM user_vocabulary_progress/u.test(sql) && /FOR UPDATE/u.test(sql);
}
function isExactReviewQuery(sql) {
  return /FROM review_events/u.test(sql) && /vocabulary_entry_id = \?/u.test(sql) && !/event_vocabulary/u.test(sql);
}
function isFallbackEvidenceQuery(sql) {
  return /FROM review_events re/u.test(sql) && /event_vocabulary/u.test(sql);
}
function isOwnerQuery(sql) {
  return /FROM vocabulary_entries ve/u.test(sql) && /JOIN vocabulary_forms vf/u.test(sql);
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
        if (isRevisionLock(sql)) return [[{ revision: 12, learning_reset_at: null }], []];
        if (isFallbackEvidenceQuery(sql)) {
          assert.match(sql, /re\.vocabulary_entry_id IS NULL OR event_vocabulary\.status <> 'active'/u);
          return [[], []];
        }
        if (isOwnerQuery(sql)) return [[], []];
        if (isProgressLock(sql)) return [[progressById.get(Number(parameters[1]))], []];
        if (isExactReviewQuery(sql)) return [[exactById.get(Number(parameters[3]))], []];
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
        assert.match(sql, /vf\.normalized_form/u, "candidate aliases must come from canonical normalized forms");
        return [[candidate(7, 101, ["graduated"]), candidate(7, 102, ["pending"])], []];
      },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 1, pendingCorrected: 1, repairedUsers: 1 });

    const transactionalSql = writes.filter(({ sql }) => !["BEGIN", "COMMIT"].includes(sql)).map(({ sql }) => sql);
    assert.match(transactionalSql[0], /user_state_revisions/u);
    assert.match(transactionalSql[0], /FOR UPDATE/u);

    const graduation = writes.find(({ sql }) => /SET due_date = NULL/u.test(sql));
    assert.ok(graduation);
    assert.match(graduation.sql, /last_reviewed_at = CASE/u);
    assert.match(graduation.sql, /last_reviewed_at IS NULL OR last_reviewed_at < \?/u);
    assert.equal(graduation.parameters[0].toISOString(), "2026-08-20T08:00:00.000Z");
    assert.equal(graduation.parameters[1].toISOString(), "2026-08-20T08:00:00.000Z");
    assert.equal(graduation.parameters[2].toISOString(), "2026-08-20T08:00:00.000Z");
    assert.equal(graduation.parameters[3], "2026-08-20");
    assert.deepEqual(graduation.parameters.slice(4), [7, 101]);

    const pendingCorrection = writes.find(({ sql }) => /SET mastered_at = NULL/u.test(sql));
    assert.ok(pendingCorrection);
    assert.deepEqual(pendingCorrection.parameters, [7, 102]);
    assert.equal(writes.filter(({ sql }) => /SET revision = revision \+ 1/u.test(sql)).length, 1);
  });

  it("normalizes fallback snapshots with the vocabulary domain before matching", async () => {
    let exactLookups = 0;
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async execute(sql, parameters = []) {
        if (isRevisionLock(sql)) return [[{ revision: 4, learning_reset_at: null }], []];
        if (isFallbackEvidenceQuery(sql)) {
          return [[review({ id: 9100, at: "2026-08-20T08:30:00.000Z", previousBox: 5, term: "  CAN’T   STOP  " })], []];
        }
        if (isOwnerQuery(sql)) return [[{ normalized_form: "can't stop", vocabulary_entry_id: 201 }], []];
        if (isProgressLock(sql)) return [[progress("2026-08-01T09:00:00.000Z")], []];
        if (isExactReviewQuery(sql)) { exactLookups += 1; return [[], []]; }
        if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(9, 201, ["can't stop"])], []]; },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
    assert.equal(exactLookups, 1);
  });

  it("does not reuse a successful final review from the introduction day or an older lifecycle", async () => {
    let graduated = false;
    const staleFinal = review({
      id: 9150,
      at: "2026-08-10T08:30:00.000Z",
      previousBox: 5,
      term: "reintroduced"
    });
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async execute(sql) {
        if (isRevisionLock(sql)) return [[{ revision: 5, learning_reset_at: null }], []];
        if (isFallbackEvidenceQuery(sql)) return [[staleFinal], []];
        if (isOwnerQuery(sql)) return [[{ normalized_form: "reintroduced", vocabulary_entry_id: 251 }], []];
        if (isProgressLock(sql)) return [[progress("2026-08-10T09:00:00.000Z", "2026-08-10")], []];
        if (isExactReviewQuery(sql)) return [[], []];
        if (/SET due_date = NULL/u.test(sql)) { graduated = true; return [{ affectedRows: 1 }, []]; }
        if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(10, 251, ["reintroduced"])], []]; },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 0, pendingCorrected: 1, repairedUsers: 1 });
    assert.equal(graduated, false, "an earlier or same-day lifecycle must never master the current card");
  });

  it("uses the first successful final review because later box-5 reviews only existed due to the old bug", async () => {
    const writes = [];
    const firstFinal = review({ id: 9300, at: "2026-08-06T08:00:00.000Z", previousBox: 5, term: "repeat-final" });
    const laterBugReview = review({ id: 9400, at: "2026-08-20T08:00:00.000Z", previousBox: 5, term: "repeat-final" });
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async execute(sql, parameters = []) {
        writes.push({ sql, parameters });
        if (isRevisionLock(sql)) return [[{ revision: 6, learning_reset_at: null }], []];
        if (isFallbackEvidenceQuery(sql)) return [[firstFinal, laterBugReview], []];
        if (isOwnerQuery(sql)) return [[{ normalized_form: "repeat-final", vocabulary_entry_id: 275 }], []];
        if (isProgressLock(sql)) return [[progress(null, "2026-07-01")], []];
        if (isExactReviewQuery(sql)) return [[], []];
        if (/SET due_date = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(12, 275, ["repeat-final"])], []]; },
      async getConnection() { return connection; }
    };

    const result = await repairHistoricalBoxFiveProgress(pool);
    assert.deepEqual(result, { mastered: 1, pendingCorrected: 0, repairedUsers: 1 });
    const graduation = writes.find(({ sql }) => /SET due_date = NULL/u.test(sql));
    assert.ok(graduation);
    assert.equal(
      graduation.parameters[0].toISOString(),
      "2026-08-06T08:00:00.000Z",
      "mastery must be dated at the first successful final review"
    );
  });

  it("does not steal a review that still belongs to another active identity", async () => {
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async execute(sql) {
        if (isRevisionLock(sql)) return [[{ revision: 6, learning_reset_at: null }], []];
        if (isFallbackEvidenceQuery(sql)) {
          assert.match(sql, /re\.vocabulary_entry_id IS NULL OR event_vocabulary\.status <> 'active'/u);
          return [[], []];
        }
        if (isOwnerQuery(sql)) return [[{ normalized_form: "reused-term", vocabulary_entry_id: 301 }], []];
        if (isProgressLock(sql)) return [[progress("2026-08-01T09:00:00.000Z")], []];
        if (isExactReviewQuery(sql)) return [[], []];
        if (/SET mastered_at = NULL/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute() { return [[candidate(11, 301, ["reused-term"])], []]; },
      async getConnection() { return connection; }
    };

    assert.deepEqual(
      await repairHistoricalBoxFiveProgress(pool),
      { mastered: 0, pendingCorrected: 1, repairedUsers: 1 }
    );
  });

  it("rejects a null-id fallback when the normalized term has another active owner", async () => {
    let graduated = false;
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async execute(sql) {
        if (isRevisionLock(sql)) return [[{ revision: 8, learning_reset_at: null }], []];
        if (isFallbackEvidenceQuery(sql)) {
          return [[review({ id: 9200, at: "2026-08-20T09:00:00.000Z", previousBox: 5, term: "shared-term" })], []];
        }
        if (isOwnerQuery(sql)) {
          return [[
            { normalized_form: "shared-term", vocabulary_entry_id: 401 },
            { normalized_form: "shared-term", vocabulary_entry_id: 402 }
          ], []];
        }
        if (isProgressLock(sql)) return [[progress("2026-08-01T09:00:00.000Z")], []];
        if (isExactReviewQuery(sql)) return [[], []];
        if (/SET due_date = NULL/u.test(sql)) { graduated = true; return [{ affectedRows: 1 }, []]; }
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
    assert.equal(graduated, false);
  });

  it("does nothing when no stuck box-five rows exist", async () => {
    let connectionRequested = false;
    const pool = {
      async execute(sql) {
        assert.match(sql, /box = 5/u);
        assert.match(sql, /due_date IS NOT NULL/u);
        return [[], []];
      },
      async getConnection() { connectionRequested = true; throw new Error("no transaction should be opened"); }
    };

    assert.deepEqual(
      await repairHistoricalBoxFiveProgress(pool),
      { mastered: 0, pendingCorrected: 0, repairedUsers: 0 }
    );
    assert.equal(connectionRequested, false);
  });
});
