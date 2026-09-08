import { LearningPathVocabularyIntakeWriter } from "../../../../application/collection-learning-path/ports/LearningPathVocabularyIntakeWriter.js";

export class MySqlLearningPathVocabularyIntakeCommandRepository extends LearningPathVocabularyIntakeWriter {
  constructor(vocabularyActivationRepository) {
    super();
    this.vocabularyActivationRepository = vocabularyActivationRepository;
  }

  async activateUnseen(userId, input) {
    return this.vocabularyActivationRepository.activateUnseen(userId, input);
  }
}
