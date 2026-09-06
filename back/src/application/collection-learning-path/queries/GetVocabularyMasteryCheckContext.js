import { loadVocabularyMasteryCheckPayload } from "../vocabularyMasteryCheckSupport.js";

export class GetVocabularyMasteryCheckContext {
  constructor({ scopedVocabularyReader }) {
    this.scopedVocabularyReader = scopedVocabularyReader;
  }

  async execute({ userId, exercise }) {
    return loadVocabularyMasteryCheckPayload(this.scopedVocabularyReader, userId, exercise);
  }
}
