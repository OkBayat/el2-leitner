import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeLegacyProgressGroup,
  repairLegacyAliasProgress
} from "../src/infrastructure/persistence/mysql/repairLegacyAliasProgress.js";

describe("legacy duplicate alias progress", () => {
  it("combines counters while retaining the most recently reviewed scheduling state", () => {
    const merged = mergeLegacyProgressGroup([
      {
        term: "centre",
        accepted: ["centre", "center"],
        box: 4,
        due: "2026-08-10",
        attempts: 8,
        correct: 7,
        mistakes: 1,
        currentStreak: 3,
        introducedOn: "2026-07-01",
        lastReviewed: "2026-08-01T10:00:00.000Z",
        notes: "British spelling"
      },
      {
        term: "center",
        accepted: ["center"],
        box: 2,
        due: "2026-08-08",
        attempts: 5,
        correct: 3,
        mistakes: 2,
        currentStreak: 1,
        introducedOn: "2026-07-03",
        lastReviewed: "2026-08-06T10:00:00.000Z",
        blockedUntil: "2026-08-08",
        notes: "US alias"
      }
    ]);

    assert.equal(merged.box, 2);
    assert.equal(merged.due, "2026-08-08");
    assert.equal(merged.attempts, 13);
    assert.equal(merged.correct, 10);
    assert.equal(merged.mistakes, 3);
    assert.equal(merged.currentStreak, 3);
    assert.equal(merged.introducedOn, "2026-07-01");
    assert.equal(merged.lastReviewed.toISOString(), "2026-08-06T10:00:00.000Z");
    assert.equal(merged.blockedUntil, "2026-08-08");
    assert.equal(merged.notes, "British spelling\nUS alias");
  });

  it("repairs each legacy user once without sorting multi-megabyte state JSON", async () => {
    const connectionCalls = [];
    const poolCalls = [];
    const stateJson = JSON.stringify({
      words: [
        { term: "centre", accepted: ["centre", "center"], box: 2, attempts: 3, correct: 2, mistakes: 1 },
        { term: "center", accepted: ["center"], box: 1, attempts: 2, correct: 1, mistakes: 1 }
      ]
    });
    const connection = {
      async beginTransaction() {},
      async commit() { connectionCalls.push({ sql: "COMMIT", parameters: [] }); },
      async rollback() {},
      release() {},
      async execute(sql, parameters = []) {
        connectionCalls.push({ sql, parameters });
        if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
        if (/UPDATE user_state_revisions/u.test(sql)) return [{ affectedRows: 1 }, []];
        throw new Error(`Unexpected transactional SQL: ${sql}`);
      }
    };
    const pool = {
      async execute(sql, parameters = []) {
        poolCalls.push({ sql, parameters });
        if (/SELECT ce\.vocabulary_entry_id, vf\.normalized_form/u.test(sql)) {
          return [[
            { vocabulary_entry_id: 55, normalized_form: "centre" },
            { vocabulary_entry_id: 55, normalized_form: "center" }
          ], []];
        }
        if (/SELECT ls\.user_id\s+FROM learning_states/u.test(sql)) {
          assert.doesNotMatch(sql, /state_json/u, "candidate query must not carry large JSON through ORDER BY");
          return [[{ user_id: 7 }], []];
        }
        if (/SELECT state_json FROM learning_states WHERE user_id/u.test(sql)) {
          assert.deepEqual(parameters, [7]);
          return [[{ state_json: stateJson }], []];
        }
        throw new Error(`Unexpected pool SQL: ${sql}`);
      },
      async getConnection() { return connection; }
    };

    const result = await repairLegacyAliasProgress(pool);
    assert.deepEqual(result, { repairedUsers: 1, repairedGroups: 1 });
    const progressWrite = connectionCalls.find(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql));
    assert.ok(progressWrite);
    assert.equal(progressWrite.parameters[0], 7);
    assert.equal(progressWrite.parameters[1], 55);
    assert.equal(progressWrite.parameters[4], 5, "attempts from both legacy cards must be preserved");
    assert.equal(progressWrite.parameters[5], 3, "correct answers from both legacy cards must be preserved");
    assert.equal(progressWrite.parameters[6], 2, "mistakes from both legacy cards must be preserved");
    assert.equal(
      poolCalls.filter(({ sql }) => /SELECT state_json FROM learning_states WHERE user_id/u.test(sql)).length,
      1,
      "legacy JSON should be loaded one user at a time by primary key"
    );
    assert.ok(connectionCalls.some(({ sql }) => /legacyAliasProgressMerged/u.test(sql)));
    assert.ok(connectionCalls.some(({ sql }) => sql === "COMMIT"));
  });
});
