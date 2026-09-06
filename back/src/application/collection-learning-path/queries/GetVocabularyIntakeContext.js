import { loadVocabularyIntakePayload } from "../vocabularyIntakeSupport.js";

export class GetVocabularyIntakeContext {
  constructor({ vocabularyIntakeReader }) {
    this.vocabularyIntakeReader = vocabularyIntakeReader;
  }

  async execute({ userId, exercise }) {
    return loadVocabularyIntakePayload(this.vocabularyIntakeReader, userId, exercise);
  }
}
