import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetScopedVocabularyQuickReviewContext } from "../src/application/collection-learning-path/queries/GetScopedVocabularyQuickReviewContext.js";
import { VerifyScopedVocabularyQuickReviewCompletion } from "../src/application/collection-learning-path/queries/VerifyScopedVocabularyQuickReviewCompletion.js";
import {
  createScopedVocabularyPracticePayload,
  resolveScopedVocabularyPracticeScope,
} from "../src/domain/collection-learning-path/ScopedVocabularyPractice.js";

function exercise(overrides = {}) {
  return {
    id: "quick-1",
    type: "vocabulary.quick-review",
    schemaVersion: 1,
    completionPolicy: "vocabulary-quick-review",
    config: { scope: { kind: "listening-episode", ref: "episode-1" } },
    ...overrides,
  };
}

const items = [
  { vocabularyId: "box1-a", term: "alpha", progress: { status: "active", box: 1, introducedOn: "2026-09-06", masteredAt: null } },
  { vocabularyId: "box1-b", term: "beta", progress: { status: "active", box: 1, introducedOn: "2026-09-06", masteredAt: null } },
  { vocabularyId: "box2", term: "gamma", progress: { status: "active", box: 2, introducedOn: "2026-09-05", masteredAt: null } },
  { vocabularyId: "mastered", term: "delta", progress: { status: "active", box: 5, introducedOn: "2026-08-01", masteredAt: "2026-09-01T00:00:00.000Z" } },
  { vocabularyId: "excluded", term: "epsilon", progress: { status: "excluded", box: 0, introducedOn: null, masteredAt: null } },
  { vocabularyId: "new", term: "zeta", progress: null },
  { vocabularyId: "box1-a", term: "alpha duplicate", progress: { status: "active", box: 1, introducedOn: "2026-09-06", masteredAt: null } },
];

class ScopedReaderFake {
  constructor(byUser = new Map([["user-1", items]])) { this.byUser = byUser; }
  async findForScope(userId) { return { items: structuredClone(this.byUser.get(userId) ?? []) }; }
}

class EvidenceReaderFake {
  constructor(value) { this.value = value; this.calls = []; }
  async findCompletedSession(userId, sessionId) {
    this.calls.push({ userId, sessionId });
    return this.value;
  }
}

describe("Scoped vocabulary quick review", () => {
  it("validates the exercise definition and listening episode scope", () => {
    assert.deepEqual(resolveScopedVocabularyPracticeScope(exercise()), { kind: "listening-episode", ref: "episode-1" });
    assert.throws(() => resolveScopedVocabularyPracticeScope(exercise({ schemaVersion: 2 })), (error) => error?.code === "INVALID_VOCABULARY_QUICK_REVIEW_DEFINITION");
    assert.throws(() => resolveScopedVocabularyPracticeScope(exercise({ config: { scope: { kind: "collection", ref: "x" } } })), (error) => error?.code === "INVALID_VOCABULARY_QUICK_REVIEW_DEFINITION");
  });

  it("returns exactly deduplicated in-scope Box 1 vocabulary", () => {
    const payload = createScopedVocabularyPracticePayload({ kind: "listening-episode", ref: "episode-1" }, items);
    assert.deepEqual(payload.items, [
      { id: "box1-a", term: "alpha" },
      { id: "box1-b", term: "beta" },
    ]);
    assert.deepEqual(payload.summary, { eligibleCount: 2, box: 1 });
  });

  it("excludes Box 2+, mastered, excluded and unseen vocabulary", () => {
    const payload = createScopedVocabularyPracticePayload({ kind: "listening-episode", ref: "episode-1" }, items);
    assert.deepEqual(payload.items.map((item) => item.id), ["box1-a", "box1-b"]);
  });

  it("hydrates an empty queue deterministically and keeps users isolated", async () => {
    const query = new GetScopedVocabularyQuickReviewContext({ scopedVocabularyReader: new ScopedReaderFake() });
    const other = await query.execute({ userId: "user-2", exercise: exercise() });
    assert.deepEqual(other.summary, { eligibleCount: 0, box: 1 });
    assert.deepEqual(other.items, []);
  });

  it("accepts an empty eligible scope without fabricated client evidence", async () => {
    const verifier = new VerifyScopedVocabularyQuickReviewCompletion({
      scopedVocabularyReader: new ScopedReaderFake(new Map([["user-1", []]])),
      quickReviewEvidenceReader: new EvidenceReaderFake(null),
    });
    const result = await verifier.execute({ userId: "user-1", exercise: exercise(), outcome: { kind: "completed" } });
    assert.equal(result.evidenceType, "vocabulary-quick-review");
    assert.match(result.evidenceRef, /:empty$/u);
  });

  it("requires a completed Learning Path quick-review session covering the exact scoped queue", async () => {
    const evidenceReader = new EvidenceReaderFake({
      mode: "learning-path.quick-review",
      status: "completed",
      plannedCount: 2,
      completedCount: 2,
      reviewedVocabularyIds: ["box1-b", "box1-a"],
    });
    const verifier = new VerifyScopedVocabularyQuickReviewCompletion({
      scopedVocabularyReader: new ScopedReaderFake(),
      quickReviewEvidenceReader: evidenceReader,
    });
    const result = await verifier.execute({
      userId: "user-1",
      exercise: exercise(),
      outcome: { kind: "completed", evidence: { sessionId: "session-1" } },
    });
    assert.equal(result.evidenceType, "vocabulary-quick-review");
    assert.match(result.evidenceRef, /session:session-1$/u);
    assert.deepEqual(evidenceReader.calls, [{ userId: "user-1", sessionId: "session-1" }]);
  });

  it("accepts completed session evidence after a reviewed House 1 word is promoted", async () => {
    const afterReviewItems = items.map((item) => item.vocabularyId === "box1-a"
      ? { ...item, progress: { ...item.progress, box: 2, lastPromotedOn: "2026-09-07" } }
      : item);
    const verifier = new VerifyScopedVocabularyQuickReviewCompletion({
      scopedVocabularyReader: new ScopedReaderFake(new Map([["user-1", afterReviewItems]])),
      quickReviewEvidenceReader: new EvidenceReaderFake({
        mode: "learning-path.quick-review",
        status: "completed",
        plannedCount: 2,
        completedCount: 2,
        reviewedVocabularyIds: ["box1-a", "box1-b"],
      }),
    });

    const result = await verifier.execute({
      userId: "user-1",
      exercise: exercise(),
      outcome: { kind: "completed", evidence: { sessionId: "session-promoted" } },
    });

    assert.equal(result.evidenceType, "vocabulary-quick-review");
    assert.match(result.evidenceRef, /session:session-promoted$/u);
  });

  it("rejects missing, cross-scope, incomplete or wrong-mode session evidence", async () => {
    for (const evidence of [
      null,
      { mode: "box1", status: "completed", plannedCount: 2, completedCount: 2, reviewedVocabularyIds: ["box1-a", "box1-b"] },
      { mode: "learning-path.quick-review", status: "active", plannedCount: 2, completedCount: 2, reviewedVocabularyIds: ["box1-a", "box1-b"] },
      { mode: "learning-path.quick-review", status: "completed", plannedCount: 2, completedCount: 1, reviewedVocabularyIds: ["box1-a"] },
      { mode: "learning-path.quick-review", status: "completed", plannedCount: 2, completedCount: 2, reviewedVocabularyIds: ["box1-a", "outside"] },
    ]) {
      const verifier = new VerifyScopedVocabularyQuickReviewCompletion({
        scopedVocabularyReader: new ScopedReaderFake(),
        quickReviewEvidenceReader: new EvidenceReaderFake(evidence),
      });
      assert.equal(await verifier.execute({
        userId: "user-1",
        exercise: exercise(),
        outcome: { kind: "completed", evidence: { sessionId: "session-1" } },
      }), false);
    }
  });
});
