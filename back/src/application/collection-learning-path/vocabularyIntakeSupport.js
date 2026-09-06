import {
  createVocabularyIntakePayload,
  resolveVocabularyIntakeScope,
} from "../../domain/collection-learning-path/VocabularyIntake.js";
import { ConflictError } from "../../domain/errors.js";

export async function loadVocabularyIntakePayload(vocabularyIntakeReader, userId, exercise) {
  const scope = resolveVocabularyIntakeScope(exercise);
  const scoped = await vocabularyIntakeReader.findForScope(userId, scope);
  const payload = createVocabularyIntakePayload(scope, scoped?.items ?? []);
  if (payload.summary.total === 0) {
    throw new ConflictError(
      "LEARNING_PATH_VOCABULARY_SCOPE_EMPTY",
      "This vocabulary intake exercise does not contain any active vocabulary items.",
    );
  }
  return payload;
}
