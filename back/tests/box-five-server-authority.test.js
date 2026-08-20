import assert from "node:assert/strict";
import { test } from "node:test";

import { RecordReviewResult } from "../src/application/learning/RecordReviewResult.js";
import { SaveLearningState } from "../src/application/learning/SaveLearningState.js";

const mondayId = "68d0f1aa-cff2-4089-9371-b2aa727f92d1";
const finalAt = "2026-08-20T10:00:00.000Z";
const finalDay = "2026-08-20";

function staleFinalWord() {
  return {
    id: mondayId,
    number: 1,
    term: "Monday",
    accepted: ["Monday"],
    category: "Calendar and time",
    notes: "",
    createdAt: "2026-08-07T12:21:53.760Z",
    box: 5,
    due: "2026-09-03",
    attempts: 6,
    correct: 6,
    mistakes: 0,
    currentStreak: 6,
    introducedOn: "2026-07-12",
    addedSource: null,
    lastReviewed: finalAt,
    lastPromotedDay: finalDay,
    blockedUntil: null,
    masteredAt: null
  };
}

function finalEvent(overrides = {}) {
  return {
    at: finalAt,
    day: finalDay,
    wordId: mondayId,
    term: "Monday",
    answer: "monday",
    correct: true,
    mode: "scheduled",
    promoted: true,
    previousBox: 5,
    newBox: 5,
    mistakeNumber: null,
    ...overrides
  };
}

function expectedGraduatedWord(word) {
  return {
    ...word,
    box: 5,
    due: null,
    blockedUntil: null,
    lastReviewed: finalAt,
    lastPromotedDay: finalDay,
    masteredAt: finalAt
  };
}

function expectedCompactWord(word) {
  return {
    id: word.id,
    box: word.box,
    due: word.due,
    attempts: word.attempts,
    correct: word.correct,
    mistakes: word.mistakes,
    currentStreak: word.currentStreak,
    introducedOn: word.introducedOn,
    addedSource: word.addedSource,
    lastReviewed: word.lastReviewed,
    lastPromotedDay: word.lastPromotedDay,
    blockedUntil: word.blockedUntil,
    masteredAt: word.masteredAt
  };
}

function daily() {
  return {
    attempts: 1,
    correct: 1,
    wrong: 0,
    newAdded: 0,
    sessions: 0,
    durationSeconds: 0
  };
}

test("the compact review command derives final mastery on the server instead of trusting stale client scheduling", async () => {
  let recorded = null;
  const useCase = new RecordReviewResult({
    reviewProgressRepository: {
      async record(_userId, command) {
        recorded = command;
        return 42;
      }
    }
  });

  const word = staleFinalWord();
  const result = await useCase.execute(7, {
    revision: 41,
    practiceSessionId: "session-monday",
    word,
    event: finalEvent(),
    daily: daily()
  });

  assert.deepEqual(result, { revision: 42 });
  assert.deepEqual(recorded.word, expectedCompactWord(expectedGraduatedWord(word)));
});

test("a correct due 5 -> 5 review is terminal even when same-day state makes promoted false", async () => {
  let recorded = null;
  const useCase = new RecordReviewResult({
    reviewProgressRepository: {
      async record(_userId, command) {
        recorded = command;
        return 51;
      }
    }
  });

  const word = {
    ...staleFinalWord(),
    due: finalDay,
    lastReviewed: "2026-08-20T09:00:00.000Z",
    lastPromotedDay: finalDay,
    masteredAt: null
  };
  const event = finalEvent({ promoted: false });

  await useCase.execute(7, {
    revision: 50,
    word,
    event,
    daily: daily()
  });

  assert.equal(recorded.event.promoted, true, "the server must normalize the stale terminal event");
  assert.deepEqual(recorded.word, expectedCompactWord(expectedGraduatedWord(word)));
});

test("the full-state compatibility path also derives final mastery from the appended 5 -> 5 event", async () => {
  let persistedState = null;
  const useCase = new SaveLearningState({
    learningStateRepository: {
      async save(_userId, state) {
        persistedState = state;
        return 42;
      }
    }
  });

  const word = staleFinalWord();
  const state = {
    schemaVersion: 2,
    createdAt: "2026-07-12T14:24:26.386Z",
    updatedAt: finalAt,
    settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
    words: [word],
    daily: { [finalDay]: daily() },
    history: [finalEvent()],
    persistenceCursor: {
      historyLength: 0,
      lastReviewFingerprint: null
    }
  };

  const result = await useCase.execute(7, state, 41);

  assert.deepEqual(result, { revision: 42 });
  assert.deepEqual(persistedState.words[0], expectedGraduatedWord(word));
});

test("entering house five schedules the real final review and clears premature mastery", async () => {
  let recorded = null;
  const useCase = new RecordReviewResult({
    reviewProgressRepository: {
      async record(_userId, command) {
        recorded = command;
        return 12;
      }
    }
  });

  const entryAt = "2026-08-06T17:12:27.997Z";
  const entryDay = "2026-08-06";
  const word = {
    ...staleFinalWord(),
    due: null,
    attempts: 5,
    correct: 5,
    lastReviewed: entryAt,
    lastPromotedDay: entryDay,
    masteredAt: entryAt
  };
  const event = finalEvent({
    at: entryAt,
    day: entryDay,
    previousBox: 4,
    newBox: 5
  });

  await useCase.execute(7, {
    revision: 11,
    word,
    event,
    daily: daily()
  });

  assert.deepEqual(recorded.word, {
    ...expectedCompactWord(word),
    box: 5,
    due: "2026-08-20",
    lastReviewed: entryAt,
    lastPromotedDay: entryDay,
    blockedUntil: null,
    masteredAt: null
  });
});

test("an old final event cannot re-master a card introduced in a later lifecycle", async () => {
  let persistedState = null;
  const useCase = new SaveLearningState({
    learningStateRepository: {
      async save(_userId, state) {
        persistedState = state;
        return 6;
      }
    }
  });

  const oldFinalAt = "2026-08-01T09:00:00.000Z";
  const oldFinalDay = "2026-08-01";
  const word = {
    ...staleFinalWord(),
    introducedOn: "2026-08-10",
    due: "2026-09-03",
    lastReviewed: oldFinalAt,
    lastPromotedDay: oldFinalDay,
    masteredAt: null
  };
  const oldFinal = finalEvent({ at: oldFinalAt, day: oldFinalDay });

  await useCase.execute(7, {
    schemaVersion: 2,
    words: [word],
    history: [oldFinal]
  }, 5);

  assert.deepEqual(persistedState.words[0], word);
});
