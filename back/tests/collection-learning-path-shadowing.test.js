import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { VerifyShadowingExerciseCompletion } from "../src/application/collection-learning-path/queries/VerifyShadowingExerciseCompletion.js";
import {
  SHADOWING_COMPLETION_POLICY,
  SHADOWING_EXERCISE_TYPE,
  resolveShadowingExerciseDefinition,
} from "../src/domain/collection-learning-path/ShadowingExercise.js";

function exercise(overrides = {}) {
  return {
    id: "shadowing-1",
    type: SHADOWING_EXERCISE_TYPE,
    schemaVersion: 1,
    completionPolicy: SHADOWING_COMPLETION_POLICY,
    config: {},
    ...overrides,
  };
}

class EvidenceReaderFake {
  constructor(value) { this.value = value; this.calls = []; }
  async findCompletedSession(userId, sessionId) {
    this.calls.push({ userId, sessionId });
    return this.value;
  }
}

describe("Learning Path shadowing exercise", () => {
  it("accepts only the v1 speaking.shadowing definition with the server completion policy", () => {
    assert.deepEqual(resolveShadowingExerciseDefinition(exercise()), { type: SHADOWING_EXERCISE_TYPE, schemaVersion: 1 });
    assert.throws(() => resolveShadowingExerciseDefinition(exercise({ type: "shadowing" })), (error) => error?.code === "INVALID_SHADOWING_EXERCISE_DEFINITION");
    assert.throws(() => resolveShadowingExerciseDefinition(exercise({ schemaVersion: 2 })), (error) => error?.code === "INVALID_SHADOWING_EXERCISE_DEFINITION");
    assert.throws(() => resolveShadowingExerciseDefinition(exercise({ completionPolicy: "explicit" })), (error) => error?.code === "INVALID_SHADOWING_EXERCISE_DEFINITION");
  });

  it("accepts evidence only from the learner's completed real Shadowing session", async () => {
    const reader = new EvidenceReaderFake({ mode: "shadowing-house-1", status: "completed", completedCount: 3, correctCount: 2, wrongCount: 1 });
    const verifier = new VerifyShadowingExerciseCompletion({ shadowingEvidenceReader: reader });
    const result = await verifier.execute({ userId: "user-1", exercise: exercise(), outcome: { kind: "completed", evidence: { sessionId: "session-1" } } });
    assert.deepEqual(result, { evidenceType: "shadowing-session", evidenceRef: "practice-session:session-1" });
    assert.deepEqual(reader.calls, [{ userId: "user-1", sessionId: "session-1" }]);
  });

  it("rejects missing, forged, unfinished, empty, or wrong-mode evidence", async () => {
    const cases = [
      { evidence: null, outcome: { kind: "completed" } },
      { evidence: null, outcome: { kind: "completed", evidence: { sessionId: "session-1" } } },
      { evidence: { mode: "shadowing-house-1", status: "active", completedCount: 1 }, outcome: { kind: "completed", evidence: { sessionId: "session-1" } } },
      { evidence: { mode: "shadowing-house-1", status: "completed", completedCount: 0 }, outcome: { kind: "completed", evidence: { sessionId: "session-1" } } },
      { evidence: { mode: "sentence-house-1", status: "completed", completedCount: 1 }, outcome: { kind: "completed", evidence: { sessionId: "session-1" } } },
    ];
    for (const item of cases) {
      const verifier = new VerifyShadowingExerciseCompletion({ shadowingEvidenceReader: new EvidenceReaderFake(item.evidence) });
      assert.equal(await verifier.execute({ userId: "user-1", exercise: exercise(), outcome: item.outcome }), false);
    }
  });

  it("rejects malformed session ids without querying persistence", async () => {
    for (const sessionId of [null, "", "   ", 7, {}, []]) {
      const reader = new EvidenceReaderFake({ mode: "shadowing-house-1", status: "completed", completedCount: 1 });
      const verifier = new VerifyShadowingExerciseCompletion({ shadowingEvidenceReader: reader });
      assert.equal(await verifier.execute({ userId: "user-1", exercise: exercise(), outcome: { kind: "completed", evidence: { sessionId } } }), false);
      assert.equal(reader.calls.length, 0);
    }
  });
});
