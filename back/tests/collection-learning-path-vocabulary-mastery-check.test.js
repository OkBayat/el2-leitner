import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StartVocabularyMasteryCheck } from "../src/application/collection-learning-path/commands/StartVocabularyMasteryCheck.js";
import { GetVocabularyMasteryCheckContext } from "../src/application/collection-learning-path/queries/GetVocabularyMasteryCheckContext.js";
import { VerifyVocabularyMasteryCheckCompletion } from "../src/application/collection-learning-path/queries/VerifyVocabularyMasteryCheckCompletion.js";
import {
  createVocabularyMasteryCheckPayload,
  resolveVocabularyMasteryCheckScope,
} from "../src/domain/collection-learning-path/VocabularyMasteryCheck.js";

const NOW = "2026-09-06T18:00:00.000Z";

function masteryExercise(overrides = {}) {
  return {
    id: "mastery-1",
    position: 1,
    type: "vocabulary.mastery-check",
    schemaVersion: 1,
    required: true,
    completionPolicy: "vocabulary-mastery-check",
    config: { scope: { kind: "listening-episode", ref: "episode-1" } },
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
    ...overrides,
  };
}

function pathDefinition() {
  return {
    id: "path-1",
    collectionId: "course-1",
    title: "Course",
    mode: "finite",
    status: "published",
    contentVersion: 1,
    publishedAt: NOW,
    retiredAt: null,
    lessons: [{
      id: "lesson-1",
      title: "Lesson 1",
      position: 1,
      sourceKind: "listening-episode",
      sourceRef: "episode-1",
      status: "published",
      introducedVersion: 1,
      retiredVersion: null,
      publishedAt: NOW,
      retiredAt: null,
      exercises: [masteryExercise()],
    }],
  };
}

const scopedItems = [
  { vocabularyId: "mastered-a", term: "alpha", progress: { status: "active", box: 5, introducedOn: "2026-08-01", masteredAt: NOW } },
  { vocabularyId: "mastered-b", term: "beta", progress: { status: "mastered", box: 5, introducedOn: "2026-08-01", masteredAt: null } },
  { vocabularyId: "learning", term: "gamma", progress: { status: "active", box: 3, introducedOn: "2026-09-01", masteredAt: null } },
  { vocabularyId: "excluded", term: "delta", progress: { status: "excluded", box: 0, introducedOn: null, masteredAt: null } },
  { vocabularyId: "new", term: "epsilon", progress: null },
  { vocabularyId: "mastered-a", term: "duplicate", progress: { status: "active", box: 5, introducedOn: "2026-08-01", masteredAt: NOW } },
];

class ScopedReaderFake {
  constructor(itemsByUser = new Map([["user-1", scopedItems]])) { this.itemsByUser = itemsByUser; }
  async findForScope(userId, scope) {
    return { scope, items: structuredClone(this.itemsByUser.get(userId) ?? []) };
  }
}

class DefinitionReaderFake {
  async findByPublicId(id) { return id === "path-1" ? pathDefinition() : null; }
}
class AccessReaderFake {
  async getForCollection() { return { canRead: true, canProgress: true }; }
}
class ProgressReaderFake {
  async findForPath(userId) {
    if (userId !== "user-1") return { path: null, lessons: [], exercises: [] };
    return {
      path: { status: "in_progress", startedAt: NOW, completedAt: null, lastActivityAt: NOW, lastSeenContentVersion: 1 },
      lessons: [{ lessonId: "lesson-1", status: "in_progress", startedAt: NOW, completedAt: null, lastActivityAt: NOW }],
      exercises: [{ exerciseId: "mastery-1", status: "in_progress", startedAt: NOW, completedAt: null, lastActivityAt: NOW }],
    };
  }
}
class SessionWriterFake {
  constructor() { this.calls = []; }
  async start(userId, input) {
    this.calls.push({ userId, input: structuredClone(input) });
    return { id: "session-1", mode: input.mode, status: "active", plannedCount: input.plannedCount };
  }
}
class EvidenceReaderFake {
  constructor(value) { this.value = value; this.calls = []; }
  async findCompletedSession(userId, sessionId) {
    this.calls.push({ userId, sessionId });
    return structuredClone(this.value);
  }
}

describe("Vocabulary mastery revalidation", () => {
  it("validates schema v1 listening-episode definitions", () => {
    assert.deepEqual(resolveVocabularyMasteryCheckScope(masteryExercise()), { kind: "listening-episode", ref: "episode-1" });
    assert.throws(() => resolveVocabularyMasteryCheckScope(masteryExercise({ schemaVersion: 2 })), (error) => error?.code === "INVALID_VOCABULARY_MASTERY_CHECK_DEFINITION");
    assert.throws(() => resolveVocabularyMasteryCheckScope(masteryExercise({ completionPolicy: "explicit" })), (error) => error?.code === "INVALID_VOCABULARY_MASTERY_CHECK_DEFINITION");
    assert.throws(() => resolveVocabularyMasteryCheckScope(masteryExercise({ config: { scope: { kind: "collection", ref: "course-1" } } })), (error) => error?.code === "INVALID_VOCABULARY_MASTERY_CHECK_DEFINITION");
  });

  it("selects exactly deduplicated mastered vocabulary from the configured scope", () => {
    const payload = createVocabularyMasteryCheckPayload({ kind: "listening-episode", ref: "episode-1" }, scopedItems);
    assert.deepEqual(payload.items, [
      { id: "mastered-a", term: "alpha" },
      { id: "mastered-b", term: "beta" },
    ]);
    assert.deepEqual(payload.summary, { eligibleCount: 2 });
  });

  it("hydrates an empty mastery queue for another learner without leaking progress", async () => {
    const query = new GetVocabularyMasteryCheckContext({ scopedVocabularyReader: new ScopedReaderFake() });
    const payload = await query.execute({ userId: "user-2", exercise: masteryExercise() });
    assert.deepEqual(payload.items, []);
    assert.deepEqual(payload.summary, { eligibleCount: 0 });
  });

  it("starts a dedicated server session from an authoritative mastered snapshot and preserves server order", async () => {
    const writer = new SessionWriterFake();
    const command = new StartVocabularyMasteryCheck({
      definitionReader: new DefinitionReaderFake(),
      progressReader: new ProgressReaderFake(),
      accessReader: new AccessReaderFake(),
      scopedVocabularyReader: new ScopedReaderFake(),
      masteryCheckSessionWriter: writer,
      orderVocabulary: (items) => [...items].reverse(),
    });

    const result = await command.execute("user-1", "path-1", "lesson-1", "mastery-1");
    assert.equal(result.session.id, "session-1");
    assert.deepEqual(result.payload.items.map((item) => item.id), ["mastered-b", "mastered-a"]);
    assert.equal(writer.calls.length, 1);
    assert.equal(writer.calls[0].input.mode, "learning-path.mastery-check");
    assert.equal(writer.calls[0].input.plannedCount, 2);
    assert.deepEqual(writer.calls[0].input.metadata.learningPath, {
      kind: "vocabulary.mastery-check",
      schemaVersion: 1,
      exerciseId: "mastery-1",
      scope: { kind: "listening-episode", ref: "episode-1" },
      vocabularyIds: ["mastered-b", "mastered-a"],
    });
  });

  it("does not create a practice session when the authoritative mastery scope is empty", async () => {
    const writer = new SessionWriterFake();
    const command = new StartVocabularyMasteryCheck({
      definitionReader: new DefinitionReaderFake(),
      progressReader: new ProgressReaderFake(),
      accessReader: new AccessReaderFake(),
      scopedVocabularyReader: new ScopedReaderFake(new Map([["user-1", []]])),
      masteryCheckSessionWriter: writer,
    });
    const result = await command.execute("user-1", "path-1", "lesson-1", "mastery-1");
    assert.equal(result.session, null);
    assert.equal(result.payload.summary.eligibleCount, 0);
    assert.equal(writer.calls.length, 0);
  });

  it("accepts completed evidence from the start snapshot even after a wrong answer demotes a word", async () => {
    const currentReader = new ScopedReaderFake(new Map([["user-1", [
      { vocabularyId: "mastered-b", term: "beta", progress: { status: "active", box: 5, introducedOn: "2026-08-01", masteredAt: NOW } },
      { vocabularyId: "mastered-a", term: "alpha", progress: { status: "active", box: 1, introducedOn: "2026-08-01", masteredAt: null } },
    ]]]));
    const evidenceReader = new EvidenceReaderFake({
      mode: "learning-path.mastery-check",
      status: "completed",
      plannedCount: 2,
      completedCount: 2,
      correctCount: 1,
      wrongCount: 1,
      metadata: { learningPath: {
        kind: "vocabulary.mastery-check",
        schemaVersion: 1,
        exerciseId: "mastery-1",
        scope: { kind: "listening-episode", ref: "episode-1" },
        vocabularyIds: ["mastered-b", "mastered-a"],
      } },
      reviewedVocabularyIds: ["mastered-b", "mastered-a"],
    });
    const verifier = new VerifyVocabularyMasteryCheckCompletion({
      scopedVocabularyReader: currentReader,
      masteryCheckEvidenceReader: evidenceReader,
    });
    const result = await verifier.execute({
      userId: "user-1",
      exercise: masteryExercise(),
      outcome: { kind: "completed", evidence: { sessionId: "session-1" } },
    });
    assert.equal(result.evidenceType, "vocabulary-mastery-check");
    assert.match(result.evidenceRef, /session:session-1$/u);
    assert.deepEqual(evidenceReader.calls, [{ userId: "user-1", sessionId: "session-1" }]);
  });

  it("rejects tampered snapshots, incomplete counts, extra ids, duplicates, and wrong modes", async () => {
    const valid = {
      mode: "learning-path.mastery-check",
      status: "completed",
      plannedCount: 2,
      completedCount: 2,
      correctCount: 2,
      wrongCount: 0,
      metadata: { learningPath: {
        kind: "vocabulary.mastery-check",
        schemaVersion: 1,
        exerciseId: "mastery-1",
        scope: { kind: "listening-episode", ref: "episode-1" },
        vocabularyIds: ["mastered-a", "mastered-b"],
      } },
      reviewedVocabularyIds: ["mastered-a", "mastered-b"],
    };
    const invalidEvidence = [
      { ...valid, mode: "review" },
      { ...valid, status: "active" },
      { ...valid, plannedCount: 3 },
      { ...valid, completedCount: 1 },
      { ...valid, reviewedVocabularyIds: ["mastered-a", "outside"] },
      { ...valid, reviewedVocabularyIds: ["mastered-a", "mastered-a"] },
      { ...valid, metadata: { learningPath: { ...valid.metadata.learningPath, exerciseId: "other" } } },
      { ...valid, metadata: { learningPath: { ...valid.metadata.learningPath, scope: { kind: "listening-episode", ref: "episode-2" } } } },
    ];
    for (const evidence of invalidEvidence) {
      const verifier = new VerifyVocabularyMasteryCheckCompletion({
        scopedVocabularyReader: new ScopedReaderFake(),
        masteryCheckEvidenceReader: new EvidenceReaderFake(evidence),
      });
      assert.equal(await verifier.execute({
        userId: "user-1",
        exercise: masteryExercise(),
        outcome: { kind: "completed", evidence: { sessionId: "session-1" } },
      }), false);
    }
  });

  it("allows an empty current mastery scope to complete without a fabricated session", async () => {
    const verifier = new VerifyVocabularyMasteryCheckCompletion({
      scopedVocabularyReader: new ScopedReaderFake(new Map([["user-1", []]])),
      masteryCheckEvidenceReader: new EvidenceReaderFake(null),
    });
    const result = await verifier.execute({ userId: "user-1", exercise: masteryExercise(), outcome: { kind: "completed" } });
    assert.equal(result.evidenceType, "vocabulary-mastery-check");
    assert.match(result.evidenceRef, /:empty$/u);
  });
});
