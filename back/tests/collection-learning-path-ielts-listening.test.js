import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetIeltsListeningExerciseContext } from "../src/application/collection-learning-path/queries/GetIeltsListeningExerciseContext.js";
import { VerifyIeltsListeningCompletion } from "../src/application/collection-learning-path/queries/VerifyIeltsListeningCompletion.js";
import {
  IELTS_LISTENING_COMPLETION_POLICY,
  IELTS_LISTENING_TYPE,
  resolveIeltsListeningReference,
} from "../src/domain/collection-learning-path/IeltsListeningExercise.js";
import { ListeningPracticeLearningPathAdapter } from "../src/infrastructure/integration/collection-learning-path/ListeningPracticeLearningPathAdapter.js";

function exercise(overrides = {}) {
  return {
    id: "ielts-1",
    type: IELTS_LISTENING_TYPE,
    schemaVersion: 1,
    completionPolicy: IELTS_LISTENING_COMPLETION_POLICY,
    config: { lessonSlug: "climate-change", testId: "test-2" },
    ...overrides,
  };
}

class ListeningReaderFake {
  constructor({ context = null, attempts = new Map() } = {}) {
    this.context = context;
    this.attempts = attempts;
    this.contextCalls = [];
    this.attemptCalls = [];
  }

  async getPublishedTest(reference) {
    this.contextCalls.push(structuredClone(reference));
    return structuredClone(this.context);
  }

  async findSubmittedAttempt(userId, attemptId) {
    this.attemptCalls.push({ userId, attemptId });
    return structuredClone(this.attempts.get(`${userId}:${attemptId}`) ?? null);
  }
}

const publicContext = {
  reference: { lessonSlug: "climate-change", testId: "test-2" },
  lesson: {
    id: "lesson-public-1",
    slug: "climate-change",
    title: "Climate change",
    description: "Listening lesson",
    episodeCode: "260903",
    episodeDate: "2026-09-03",
    sourceUrl: "https://www.bbc.co.uk/example",
    level: "intermediate",
    imageUrl: null,
    vocabularyCollectionId: null,
    audioUrl: "/api/listening/bbc/lessons/climate-change/audio",
    questionCount: 1,
    testCount: 1,
  },
  test: {
    id: "test-2",
    title: "Test 2",
    position: 2,
    format: "ielts",
    difficulty: "medium",
    questionCount: 1,
    groups: [{
      id: "group-1",
      position: 1,
      heading: "Questions 1",
      taskType: "note_completion",
      instruction: "Complete the note.",
      answerInstruction: "Write one word.",
      maxWords: 1,
      maxNumbers: 0,
      questions: [{ id: "q1", number: 1, position: 1, responseType: "text", prompt: "The {{blank}}." }],
    }],
  },
};

describe("Learning Path IELTS listening exercise", () => {
  it("validates the namespaced type, schema version, completion policy and listening reference", () => {
    assert.deepEqual(resolveIeltsListeningReference(exercise()), {
      lessonSlug: "climate-change",
      testId: "test-2",
    });
    for (const invalid of [
      exercise({ type: "listening.other" }),
      exercise({ schemaVersion: 2 }),
      exercise({ completionPolicy: "explicit" }),
      exercise({ config: { lessonSlug: "", testId: "test-2" } }),
      exercise({ config: { lessonSlug: "climate-change", testId: "" } }),
    ]) {
      assert.throws(
        () => resolveIeltsListeningReference(invalid),
        (error) => error?.code === "INVALID_IELTS_LISTENING_DEFINITION",
      );
    }
  });

  it("hydrates the exercise through the listening read port without creating an attempt", async () => {
    const reader = new ListeningReaderFake({ context: publicContext });
    const query = new GetIeltsListeningExerciseContext({ ieltsListeningReader: reader });

    const payload = await query.execute({ userId: "user-1", exercise: exercise() });

    assert.deepEqual(payload, publicContext);
    assert.deepEqual(reader.contextCalls, [{ lessonSlug: "climate-change", testId: "test-2" }]);
  });

  it("accepts only a submitted attempt owned by the learner and matching the configured lesson and test", async () => {
    const attempts = new Map([["user-1:attempt-1", {
      id: "attempt-1",
      userId: "user-1",
      provider: "bbc_6_minute_english",
      lessonSlug: "climate-change",
      testId: "test-2",
      status: "completed",
      submittedAt: "2026-09-06T18:00:00.000Z",
    }]]);
    const reader = new ListeningReaderFake({ attempts });
    const verifier = new VerifyIeltsListeningCompletion({ ieltsListeningReader: reader });

    const result = await verifier.execute({
      userId: "user-1",
      exercise: exercise(),
      outcome: { kind: "completed", evidence: { attemptId: "attempt-1" } },
    });

    assert.deepEqual(result, { evidenceType: "listening-attempt", evidenceRef: "attempt-1" });
    assert.deepEqual(reader.attemptCalls, [{ userId: "user-1", attemptId: "attempt-1" }]);
  });

  it("rejects missing, cross-user, active, cross-lesson and cross-test evidence", async () => {
    const cases = [
      null,
      { id: "attempt-1", userId: "user-1", provider: "bbc_6_minute_english", lessonSlug: "climate-change", testId: "test-2", status: "active", submittedAt: null },
      { id: "attempt-1", userId: "user-1", provider: "bbc_6_minute_english", lessonSlug: "other-lesson", testId: "test-2", status: "completed", submittedAt: "2026-09-06T18:00:00.000Z" },
      { id: "attempt-1", userId: "user-1", provider: "bbc_6_minute_english", lessonSlug: "climate-change", testId: "test-3", status: "completed", submittedAt: "2026-09-06T18:00:00.000Z" },
      { id: "attempt-1", userId: "user-2", provider: "bbc_6_minute_english", lessonSlug: "climate-change", testId: "test-2", status: "completed", submittedAt: "2026-09-06T18:00:00.000Z" },
    ];

    for (const evidence of cases) {
      const attempts = new Map(evidence ? [["user-1:attempt-1", evidence]] : []);
      const verifier = new VerifyIeltsListeningCompletion({
        ieltsListeningReader: new ListeningReaderFake({ attempts }),
      });
      assert.equal(await verifier.execute({
        userId: "user-1",
        exercise: exercise(),
        outcome: { kind: "completed", evidence: { attemptId: "attempt-1" } },
      }), false);
    }

    const verifier = new VerifyIeltsListeningCompletion({ ieltsListeningReader: new ListeningReaderFake() });
    assert.equal(await verifier.execute({ userId: "user-1", exercise: exercise(), outcome: { kind: "completed" } }), false);
  });

  it("projects public listening data and strips answer keys at the anti-corruption boundary", async () => {
    const calls = [];
    const listeningPracticeRepository = {
      async findPublishedLessonBySlug(provider, slug, options) {
        calls.push({ provider, slug, options });
        return {
          databaseId: 99,
          id: "lesson-public-1",
          provider,
          slug,
          title: "Climate change",
          description: "Listening lesson",
          episodeCode: "260903",
          episodeDate: "2026-09-03",
          sourceUrl: "https://www.bbc.co.uk/example",
          audioFile: "secret-local.mp3",
          assetDirectory: "/private/assets",
          level: "intermediate",
          imageFile: null,
          vocabularyCollectionId: null,
          contentVersion: 7,
          questionCount: 1,
          testCount: 1,
          tests: [{
            id: "test-2",
            title: "Test 2",
            position: 2,
            format: "ielts",
            difficulty: "medium",
            questionCount: 1,
            groups: [{
              id: "group-1",
              position: 1,
              heading: "Questions 1",
              taskType: "note_completion",
              instruction: "Complete the note.",
              answerInstruction: "Write one word.",
              maxWords: 1,
              maxNumbers: 0,
              questions: [{
                id: "q1",
                number: 1,
                position: 1,
                responseType: "text",
                prompt: "The {{blank}}.",
                acceptedAnswers: [{ text: "answer", normalized: "answer", primary: true }],
              }],
            }],
          }],
        };
      },
      async findCompletedAttempt() { return null; },
    };
    const adapter = new ListeningPracticeLearningPathAdapter({ listeningPracticeRepository });

    const payload = await adapter.getPublishedTest({ lessonSlug: "climate-change", testId: "test-2" });

    assert.deepEqual(calls, [{
      provider: "bbc_6_minute_english",
      slug: "climate-change",
      options: { includeAnswers: false },
    }]);
    assert.equal("databaseId" in payload.lesson, false);
    assert.equal("audioFile" in payload.lesson, false);
    assert.equal("acceptedAnswers" in payload.test.groups[0].questions[0], false);
    assert.deepEqual(payload.reference, { lessonSlug: "climate-change", testId: "test-2" });
  });
});
