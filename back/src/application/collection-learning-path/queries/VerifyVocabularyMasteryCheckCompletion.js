import {
  VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY,
  VOCABULARY_MASTERY_CHECK_SESSION_MODE,
  parseVocabularyMasteryCheckSessionSnapshot,
  resolveVocabularyMasteryCheckScope,
  reviewedVocabularyMatchesMasterySnapshot,
  vocabularyMasteryCheckEvidenceRef,
  vocabularyMasterySnapshotMatchesExercise,
} from "../../../domain/collection-learning-path/VocabularyMasteryCheck.js";
import { loadVocabularyMasteryCheckPayload } from "../vocabularyMasteryCheckSupport.js";

function evidenceSessionId(outcome) {
  const sessionId = String(outcome?.evidence?.sessionId ?? "").trim();
  return sessionId && sessionId.length <= 64 ? sessionId : null;
}

export class VerifyVocabularyMasteryCheckCompletion {
  constructor({ scopedVocabularyReader, masteryCheckEvidenceReader }) {
    this.scopedVocabularyReader = scopedVocabularyReader;
    this.masteryCheckEvidenceReader = masteryCheckEvidenceReader;
  }

  async execute({ userId, exercise, outcome }) {
    const scope = resolveVocabularyMasteryCheckScope(exercise);
    const sessionId = evidenceSessionId(outcome);
    if (!sessionId) {
      const payload = await loadVocabularyMasteryCheckPayload(this.scopedVocabularyReader, userId, exercise);
      if (payload.summary.eligibleCount !== 0) return false;
      return {
        evidenceType: VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY,
        evidenceRef: vocabularyMasteryCheckEvidenceRef(scope),
      };
    }

    const evidence = await this.masteryCheckEvidenceReader.findCompletedSession(userId, sessionId);
    if (!evidence || evidence.mode !== VOCABULARY_MASTERY_CHECK_SESSION_MODE || evidence.status !== "completed") {
      return false;
    }
    const snapshot = parseVocabularyMasteryCheckSessionSnapshot(evidence.metadata);
    if (!vocabularyMasterySnapshotMatchesExercise(snapshot, exercise, scope)) return false;
    if (Number(evidence.plannedCount) !== snapshot.vocabularyIds.length) return false;
    if (Number(evidence.completedCount) !== snapshot.vocabularyIds.length) return false;
    if (Number(evidence.correctCount ?? 0) + Number(evidence.wrongCount ?? 0) !== snapshot.vocabularyIds.length) return false;
    if (!reviewedVocabularyMatchesMasterySnapshot(snapshot, evidence.reviewedVocabularyIds)) return false;

    return {
      evidenceType: VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY,
      evidenceRef: vocabularyMasteryCheckEvidenceRef(scope, sessionId),
    };
  }
}
