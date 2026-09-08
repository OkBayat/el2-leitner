import { LearningPathVocabularySpellingSessionWriter } from "../../../../application/collection-learning-path/ports/LearningPathVocabularySpellingSessionWriter.js";

export class MySqlLearningPathVocabularySpellingSessionCommandRepository extends LearningPathVocabularySpellingSessionWriter {
  constructor(practiceSessionRepository) {
    super();
    this.practiceSessionRepository = practiceSessionRepository;
  }

  async start(userId, input) {
    return this.practiceSessionRepository.start(userId, input);
  }
}
