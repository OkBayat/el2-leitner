import {
  createVocabularyMasteryCheckPayload,
  resolveVocabularyMasteryCheckScope,
} from "../../domain/collection-learning-path/VocabularyMasteryCheck.js";

export async function loadVocabularyMasteryCheckPayload(scopedVocabularyReader, userId, exercise) {
  const scope = resolveVocabularyMasteryCheckScope(exercise);
  const scoped = await scopedVocabularyReader.findForScope(userId, scope);
  return createVocabularyMasteryCheckPayload(scope, scoped?.items ?? []);
}
