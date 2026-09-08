import {
  VOCABULARY_SPELLING_COMPLETION_POLICY,
  VOCABULARY_SPELLING_SESSION_MODE,
  createVocabularySpellingPayload,
  parseVocabularySpellingScope,
  parseVocabularySpellingSessionSnapshot,
  resolveVocabularySpellingDefinition,
  reviewedVocabularyMatchesSpellingSnapshot,
  vocabularySpellingEvidenceRef,
  vocabularySpellingItemsForScope,
  vocabularySpellingSnapshotMatches,
} from "../../../domain/collection-learning-path/VocabularySpellingPractice.js";

function sessionId(value) {
  const id = String(value ?? "").trim();
  return id && id.length <= 64 ? id : null;
}

export class VerifyVocabularySpellingCompletion {
  constructor({ spellingReader, spellingEvidenceReader }) {
    this.spellingReader = spellingReader;
    this.spellingEvidenceReader = spellingEvidenceReader;
  }

  async execute({ userId, path, lesson, exercise, outcome }) {
    const definition = resolveVocabularySpellingDefinition(path, exercise);
    const scope = parseVocabularySpellingScope(outcome?.evidence?.scope);
    if (!scope) return false;
    const evidenceSessionId = sessionId(outcome?.evidence?.sessionId);
    if (!evidenceSessionId) {
      const vocabulary = await this.spellingReader.findForCourseAndLearner(userId, definition.collectionId);
      const payload = createVocabularySpellingPayload(definition.collectionId, vocabulary?.items ?? []);
      if (vocabularySpellingItemsForScope(payload, scope).length !== 0) return false;
      return {
        evidenceType: VOCABULARY_SPELLING_COMPLETION_POLICY,
        evidenceRef: vocabularySpellingEvidenceRef(definition.collectionId, scope),
      };
    }

    const evidence = await this.spellingEvidenceReader.findCompletedSession(userId, evidenceSessionId);
    if (!evidence || evidence.mode !== VOCABULARY_SPELLING_SESSION_MODE || evidence.status !== "completed") return false;
    const snapshot = parseVocabularySpellingSessionSnapshot(evidence.metadata);
    if (!vocabularySpellingSnapshotMatches(snapshot, { path, lesson, exercise }, scope, definition.aggregationMode)) return false;
    if (Number(evidence.plannedCount) !== snapshot.vocabularyIds.length) return false;
    if (Number(evidence.completedCount) !== snapshot.vocabularyIds.length) return false;
    if (Number(evidence.correctCount ?? 0) + Number(evidence.wrongCount ?? 0) !== snapshot.vocabularyIds.length) return false;
    if (!reviewedVocabularyMatchesSpellingSnapshot(snapshot, evidence.reviewedVocabularyIds)) return false;
    return {
      evidenceType: VOCABULARY_SPELLING_COMPLETION_POLICY,
      evidenceRef: vocabularySpellingEvidenceRef(definition.collectionId, scope, evidenceSessionId),
    };
  }
}
