import { resolveShadowingExerciseDefinition } from "../../../domain/collection-learning-path/ShadowingExercise.js";

export class VerifyShadowingExerciseCompletion {
  constructor({ shadowingEvidenceReader }) { this.shadowingEvidenceReader = shadowingEvidenceReader; }
  async execute({ userId, exercise, outcome }) {
    resolveShadowingExerciseDefinition(exercise);
    const sessionId = outcome?.evidence?.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) return false;
    const id = sessionId.trim();
    const session = await this.shadowingEvidenceReader.findCompletedSession(userId, id);
    if (!session || session.mode !== "shadowing-house-1" || session.status !== "completed" || Number(session.completedCount) <= 0) return false;
    return { evidenceType: "shadowing-session", evidenceRef: `practice-session:${id}` };
  }
}
