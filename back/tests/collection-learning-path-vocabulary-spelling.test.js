import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StartVocabularySpelling } from "../src/application/collection-learning-path/commands/StartVocabularySpelling.js";
import { VerifyVocabularySpellingCompletion } from "../src/application/collection-learning-path/queries/VerifyVocabularySpellingCompletion.js";
import {
  VOCABULARY_SPELLING_SESSION_MODE,
  createVocabularySpellingPayload,
  parseVocabularySpellingSessionSnapshot,
  resolveVocabularySpellingDefinition,
  resolveVocabularySpellingCollectionId,
} from "../src/domain/collection-learning-path/VocabularySpellingPractice.js";

function exercise(overrides = {}) {
  return {
    id: "spelling-1",
    type: "slide-base",
    schemaVersion: 1,
    completionPolicy: "vocabulary-spelling",
    config: {
      slides: [
        {
          id: "spelling-scope",
          type: "leitner-house-one-scope",
          data: { generatedSlide: { type: "dictation" } },
        },
        {
          id: "spelling-summary",
          type: "summary",
          terminal: true,
          data: { aggregationMode: "first-attempts" },
        },
      ],
    },
    ...overrides,
  };
}

function path() {
  return { id: "path-1", collectionId: "cambridge-vocabulary-for-ielts" };
}

function lesson() {
  return { id: "lesson-1" };
}

const vocabulary = [
  { vocabularyId: "course-a", term: "alpha", accepted: ["alpha"], courseMember: true, progress: { status: "active", box: 1 } },
  { vocabularyId: "course-b", term: "beta", accepted: ["beta", "Beta"], courseMember: true, progress: { status: "active", box: 1 } },
  { vocabularyId: "other", term: "gamma", accepted: ["gamma"], courseMember: false, progress: { status: "active", box: 1 } },
  { vocabularyId: "box-two", term: "delta", accepted: ["delta"], courseMember: true, progress: { status: "active", box: 2 } },
  { vocabularyId: "excluded", term: "epsilon", accepted: ["epsilon"], courseMember: true, progress: { status: "excluded", box: 1 } },
];

class SpellingReaderFake {
  constructor(items = vocabulary) { this.items = items; }
  async findForCourseAndLearner() { return { items: structuredClone(this.items) }; }
}

class EvidenceReaderFake {
  constructor(value) { this.value = value; }
  async findCompletedSession() { return structuredClone(this.value); }
}

class PracticeSessionWriterFake {
  calls = [];
  async start(userId, input) {
    this.calls.push({ userId, input: structuredClone(input) });
    return { id: `session-${this.calls.length}` };
  }
}

describe("Vocabulary spelling practice", () => {
  it("validates its canonical exercise contract", () => {
    assert.equal(resolveVocabularySpellingCollectionId(path(), exercise()), "cambridge-vocabulary-for-ielts");
    assert.throws(() => resolveVocabularySpellingCollectionId(path(), exercise({ schemaVersion: 2 })), (error) => error?.code === "INVALID_VOCABULARY_SPELLING_DEFINITION");
    assert.throws(() => resolveVocabularySpellingCollectionId(path(), exercise({ config: {} })), (error) => error?.code === "INVALID_VOCABULARY_SPELLING_DEFINITION");
  });

  it("supports first, all, and latest summary aggregation while defaulting to first", () => {
    assert.equal(resolveVocabularySpellingDefinition(path(), exercise()).aggregationMode, "first-attempts");
    for (const aggregationMode of ["all-attempts", "latest-attempts"]) {
      const configured = exercise();
      configured.config.slides[1].data.aggregationMode = aggregationMode;
      assert.equal(resolveVocabularySpellingDefinition(path(), configured).aggregationMode, aggregationMode);
    }
    const invalid = exercise();
    invalid.config.slides[1].data.aggregationMode = "unknown";
    assert.throws(() => resolveVocabularySpellingDefinition(path(), invalid), (error) => error?.code === "INVALID_VOCABULARY_SPELLING_DEFINITION");
  });

  it("builds deduplicated course and whole-House-1 queues with accepted spellings", () => {
    const payload = createVocabularySpellingPayload("cambridge-vocabulary-for-ielts", [vocabulary[0], vocabulary[0], ...vocabulary.slice(1)]);
    assert.deepEqual(payload.courseItems.map((item) => item.id), ["course-a", "course-b"]);
    assert.deepEqual(payload.allItems.map((item) => item.id), ["course-a", "course-b", "other"]);
    assert.deepEqual(payload.courseItems[1].accepted, ["beta", "Beta"]);
    assert.deepEqual(payload.summary, { box: 1, courseCount: 2, allCount: 3 });
  });

  it("verifies an exact completed course-scoped spelling session", async () => {
    const metadata = {
      learningPath: {
        kind: "vocabulary-spelling",
        schemaVersion: 1,
        pathId: "path-1",
        lessonId: "lesson-1",
        exerciseId: "spelling-1",
        scope: "course",
        aggregationMode: "first-attempts",
        vocabularyIds: ["course-a", "course-b"],
      },
    };
    const verifier = new VerifyVocabularySpellingCompletion({
      spellingReader: new SpellingReaderFake(),
      spellingEvidenceReader: new EvidenceReaderFake({
        mode: VOCABULARY_SPELLING_SESSION_MODE,
        status: "completed",
        plannedCount: 2,
        completedCount: 2,
        correctCount: 1,
        wrongCount: 1,
        metadata,
        reviewedVocabularyIds: ["course-b", "course-a"],
      }),
    });
    const result = await verifier.execute({
      userId: "user-1",
      path: path(),
      lesson: lesson(),
      exercise: exercise(),
      outcome: { kind: "completed", evidence: { scope: "course", sessionId: "session-1" } },
    });
    assert.equal(result.evidenceType, "vocabulary-spelling");
    assert.match(result.evidenceRef, /course:session:session-1$/u);
  });

  it("starts a separate persisted session with an immutable lesson and exercise snapshot", async () => {
    const sessions = new PracticeSessionWriterFake();
    const command = new StartVocabularySpelling({
      definitionReader: { findByPublicId: async () => ({ ...path(), status: "published", lessons: [] }) },
      progressReader: {},
      accessReader: {},
      spellingReader: new SpellingReaderFake(),
      practiceSessionWriter: sessions,
      loadStartedExercise: async () => ({ path: path(), lesson: lesson(), exercise: exercise() }),
    });

    const first = await command.execute("user-1", "path-1", "lesson-1", "spelling-1", "course");
    const second = await command.execute("user-1", "path-1", "lesson-1", "spelling-1", "course");

    assert.equal(first.session.id, "session-1");
    assert.equal(second.session.id, "session-2");
    assert.deepEqual(first.payload.items.map((item) => item.id), ["course-a", "course-b"]);
    assert.equal(sessions.calls.length, 2);
    assert.deepEqual(parseVocabularySpellingSessionSnapshot(sessions.calls[0].input.metadata), {
      pathId: "path-1",
      lessonId: "lesson-1",
      exerciseId: "spelling-1",
      scope: "course",
      aggregationMode: "first-attempts",
      vocabularyIds: ["course-a", "course-b"],
    });
  });

  it("rejects a partial whole-House-1 session and accepts an empty selected scope", async () => {
    const partial = new VerifyVocabularySpellingCompletion({
      spellingReader: new SpellingReaderFake(),
      spellingEvidenceReader: new EvidenceReaderFake({
        mode: VOCABULARY_SPELLING_SESSION_MODE,
        status: "completed",
        plannedCount: 2,
        completedCount: 2,
        reviewedVocabularyIds: ["course-a", "course-b"],
      }),
    });
    assert.equal(await partial.execute({
      userId: "user-1",
      path: path(),
      lesson: lesson(),
      exercise: exercise(),
      outcome: { kind: "completed", evidence: { scope: "all", sessionId: "session-1" } },
    }), false);

    const empty = new VerifyVocabularySpellingCompletion({
      spellingReader: new SpellingReaderFake([]),
      spellingEvidenceReader: new EvidenceReaderFake(null),
    });
    const result = await empty.execute({
      userId: "user-1",
      path: path(),
      lesson: lesson(),
      exercise: exercise(),
      outcome: { kind: "completed", evidence: { scope: "all" } },
    });
    assert.match(result.evidenceRef, /all:empty$/u);
  });
});
