import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RecordReviewResult } from "../src/application/learning/RecordReviewResult.js";

function validInput() {
  return {
    revision: 8,
    practiceSessionId: "session-1",
    word: {
      id: "vocab-monday",
      box: 2,
      due: "2026-08-17",
      attempts: 4,
      correct: 3,
      mistakes: 1,
      currentStreak: 2,
      introducedOn: "2026-08-15",
      addedSource: "daily",
      lastReviewed: "2026-08-15T08:00:00.000Z",
      lastPromotedDay: "2026-08-15",
      blockedUntil: null,
      masteredAt: null
    },
    event: {
      at: "2026-08-15T08:00:00.000Z",
      day: "2026-08-15",
      wordId: "vocab-monday",
      term: "Monday",
      answer: "monday",
      correct: true,
      mode: "review",
      promoted: true,
      previousBox: 1,
      newBox: 2,
      mistakeNumber: null
    },
    daily: {
      attempts: 12,
      correct: 10,
      wrong: 2,
      newAdded: 10,
      sessions: 0,
      durationSeconds: 0
    }
  };
}

describe("RecordReviewResult", () => {
  it("forwards one normalized review command to its repository", async () => {
    const calls = [];
    const useCase = new RecordReviewResult({
      reviewProgressRepository: {
        async record(userId, command) {
          calls.push({ userId, command });
          return 9;
        }
      }
    });

    const result = await useCase.execute(7, validInput());
    assert.deepEqual(result, { revision: 9 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].userId, 7);
    assert.equal(calls[0].command.word.id, "vocab-monday");
    assert.equal(calls[0].command.event.wordId, "vocab-monday");
    assert.equal(calls[0].command.daily.attempts, 12);
  });

  it("rejects a review event for a different word", async () => {
    const useCase = new RecordReviewResult({ reviewProgressRepository: { record: async () => 9 } });
    const input = validInput();
    input.event.wordId = "vocab-tuesday";
    await assert.rejects(() => useCase.execute(7, input), /event\.wordId must match word\.id/u);
  });

  it("rejects an event/progress box mismatch", async () => {
    const useCase = new RecordReviewResult({ reviewProgressRepository: { record: async () => 9 } });
    const input = validInput();
    input.event.newBox = 3;
    await assert.rejects(() => useCase.execute(7, input), /event\.newBox must match word\.box/u);
  });

  it("rejects invalid counters before touching persistence", async () => {
    let called = false;
    const useCase = new RecordReviewResult({
      reviewProgressRepository: { async record() { called = true; return 9; } }
    });
    const input = validInput();
    input.daily.attempts = -1;
    await assert.rejects(() => useCase.execute(7, input), /daily\.attempts/u);
    assert.equal(called, false);
  });
});
