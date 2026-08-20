import assert from "node:assert/strict";
import { test } from "node:test";

import { SaveLearningState } from "../src/application/learning/SaveLearningState.js";

const wordId = "68d0f1aa-cff2-4089-9371-b2aa727f92d1";
const progressAt = "2026-08-20T10:00:00.000Z";
const eventAt = "2026-08-20T10:00:00.004Z";
const day = "2026-08-20";

test("the compatibility write accepts the old client's millisecond timestamp drift", async () => {
  let persistedState = null;
  const useCase = new SaveLearningState({
    learningStateRepository: {
      async save(_userId, state) {
        persistedState = state;
        return 9;
      }
    }
  });

  await useCase.execute(7, {
    schemaVersion: 2,
    words: [{
      id: wordId,
      term: "Monday",
      accepted: ["Monday"],
      box: 5,
      due: "2026-09-03",
      attempts: 6,
      correct: 6,
      mistakes: 0,
      currentStreak: 6,
      introducedOn: "2026-07-12",
      lastReviewed: progressAt,
      lastPromotedDay: day,
      blockedUntil: null,
      masteredAt: null
    }],
    daily: {},
    history: [{
      at: eventAt,
      day,
      wordId,
      term: "Monday",
      answer: "Monday",
      correct: true,
      mode: "scheduled",
      promoted: true,
      previousBox: 5,
      newBox: 5,
      mistakeNumber: null
    }],
    persistenceCursor: { historyLength: 0, lastReviewFingerprint: null }
  }, 8);

  assert.equal(persistedState.words[0].due, null);
  assert.equal(persistedState.words[0].lastReviewed, eventAt);
  assert.equal(persistedState.words[0].masteredAt, eventAt);
});
