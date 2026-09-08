import {
  resolveSlideSequenceDefinition,
  verifySlideSequenceCompletion,
} from "../../../domain/collection-learning-path/SlideSequenceExercise.js";

export class VerifySlideSequenceCompletion {
  constructor({ vocabularyReader }) {
    this.vocabularyReader = vocabularyReader;
  }

  async execute({ userId, exercise, outcome }) {
    const definition = resolveSlideSequenceDefinition(exercise);
    const scoped = definition.scope
      ? await this.vocabularyReader.findForScope(userId, definition.scope)
      : null;
    return verifySlideSequenceCompletion(exercise, outcome, scoped?.items ?? []);
  }
}
