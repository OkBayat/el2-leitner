import { resolveIeltsListeningReference } from "../../../domain/collection-learning-path/IeltsListeningExercise.js";

export class GetIeltsListeningExerciseContext {
  constructor({ ieltsListeningReader }) {
    this.ieltsListeningReader = ieltsListeningReader;
  }

  async execute({ exercise }) {
    const reference = resolveIeltsListeningReference(exercise);
    return this.ieltsListeningReader.getPublishedTest(reference);
  }
}
