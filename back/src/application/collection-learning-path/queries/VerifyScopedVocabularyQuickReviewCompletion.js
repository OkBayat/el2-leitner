import {
  VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
  VOCABULARY_QUICK_REVIEW_SESSION_MODE,
  createScopedVocabularyPracticePayload,
  resolveScopedVocabularyPracticeScope,
  reviewedIdsProveScopedQuickReview,
  scopedVocabularyPracticeEvidenceRef,
} from "../../../domain/collection-learning-path/ScopedVocabularyPractice.js";

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
    const scope = resolveScopedVocabularyPracticeScope(exercise);
    const scoped = await this.scopedVocabularyReader.findForScope(userId, scope);
    const scopedItems = scoped?.items ?? [];
    const payload = createScopedVocabularyPracticePayload(scope, scopedItems);
    const sessionId = evidenceSessionId(outcome);

    if (!sessionId) {
      if (payload.summary.eligibleCount !== 0) return false;
      return {
        evidenceType: VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
        evidenceRef: scopedVocabularyPracticeEvidenceRef(payload.scope),
      };
    }

    const evidence = await this.quickReviewEvidenceReader.findCompletedSession(userId, sessionId);
    if (!evidence || evidence.mode !== VOCABULARY_QUICK_REVIEW_SESSION_MODE || evidence.status !== "completed") {
      return false;
    }
    if (!reviewedIdsProveScopedQuickReview(scopedItems, payload, evidence)) return false;

    return {
      evidenceType: VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
      evidenceRef: scopedVocabularyPracticeEvidenceRef(payload.scope, sessionId),
    };
  }
}
