import {
  createScopedVocabularyPracticePayload,
  resolveScopedVocabularyPracticeScope,
} from "../../domain/collection-learning-path/ScopedVocabularyPractice.js";

export async function loadScopedVocabularyPracticePayload(scopedVocabularyReader, userId, exercise) {
  const scope = resolveScopedVocabularyPracticeScope(exercise);
  const scoped = await scopedVocabularyReader.findForScope(userId, scope);
  return createScopedVocabularyPracticePayload(scope, scoped?.items ?? []);
}
