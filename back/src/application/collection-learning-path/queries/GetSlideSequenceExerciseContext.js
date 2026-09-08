import {
  createSlideSequenceVocabularyPayload,
  resolveSlideSequenceDefinition,
} from "../../../domain/collection-learning-path/SlideSequenceExercise.js";
import { ConflictError } from "../../../domain/errors.js";

export class GetSlideSequenceExerciseContext {
  constructor({ vocabularyReader }) {
    this.vocabularyReader = vocabularyReader;
  }

  async execute({ userId, exercise }) {
    const definition = resolveSlideSequenceDefinition(exercise);
    if (!definition.scope) return null;
    const scoped = await this.vocabularyReader.findForScope(userId, definition.scope);
    const payload = createSlideSequenceVocabularyPayload(definition.scope, scoped?.items ?? []);
    if (payload.summary.total === 0) {
      throw new ConflictError(
        "LEARNING_PATH_VOCABULARY_SCOPE_EMPTY",
        "This slide sequence does not contain any active vocabulary items.",
      );
    }
    return payload;
  }
}
