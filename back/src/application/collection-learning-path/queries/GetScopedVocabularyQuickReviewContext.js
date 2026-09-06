import { loadScopedVocabularyPracticePayload } from "../scopedVocabularyPracticeSupport.js";

export class GetScopedVocabularyQuickReviewContext {
  constructor({ scopedVocabularyReader }) {
    this.scopedVocabularyReader = scopedVocabularyReader;
  }

  async execute({ userId, exercise }) {
    return loadScopedVocabularyPracticePayload(this.scopedVocabularyReader, userId, exercise);
  }
}
