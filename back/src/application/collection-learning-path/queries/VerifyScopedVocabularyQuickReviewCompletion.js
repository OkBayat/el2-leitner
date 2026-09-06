import {
  VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
  VOCABULARY_QUICK_REVIEW_SESSION_MODE,
  reviewedIdsMatchScope,
  scopedVocabularyPracticeEvidenceRef,
} from "../../../domain/collection-learning-path/ScopedVocabularyPractice.js";
import { loadScopedVocabularyPracticePayload } from "../scopedVocabularyPracticeSupport.js";

function evidenceSessionId(outcome) {
  const sessionId = String(outcome?.evidence?.sessionId ?? "").trim();
  return sessionId && sessionId.length <= 64 ? sessionId : null;
}

export class VerifyScopedVocabularyQuickReviewCompletion {
  constructor({ scopedVocabularyReader, quickReviewEvidenceReader }) {
    this.scopedVocabularyReader = scopedVocabularyReader;
    this.quickReviewEvidenceReader = quickReviewEvidenceReader;
  }

  async execute({ userId, exercise, outcome }) {
    const payload = await loadScopedVocabularyPracticePayload(this.scopedVocabularyReader, userId, exercise);
    if (payload.summary.eligibleCount === 0) {
      return {
        evidenceType: VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
        evidenceRef: scopedVocabularyPracticeEvidenceRef(payload.scope),
      };
    }

    const sessionId = evidenceSessionId(outcome);
    if (!sessionId) return false;
    const evidence = await this.quickReviewEvidenceReader.findCompletedSession(userId, sessionId);
    if (!evidence || evidence.mode !== VOCABULARY_QUICK_REVIEW_SESSION_MODE || evidence.status !== "completed") {
      return false;
    }
    if (Number(evidence.plannedCount) !== payload.summary.eligibleCount) return false;
    if (Number(evidence.completedCount) !== payload.summary.eligibleCount) return false;
    if (!reviewedIdsMatchScope(payload, evidence)) return false;

    return {
      evidenceType: VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
      evidenceRef: scopedVocabularyPracticeEvidenceRef(payload.scope, sessionId),
    };
  }
}
