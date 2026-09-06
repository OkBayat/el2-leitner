import { LearningPathMasteryCheckSessionWriter } from "../../../../application/collection-learning-path/ports/LearningPathMasteryCheckSessionWriter.js";

export class MySqlLearningPathMasteryCheckSessionCommandRepository extends LearningPathMasteryCheckSessionWriter {
  constructor(practiceSessionRepository) {
    super();
    this.practiceSessionRepository = practiceSessionRepository;
  }

  async start(userId, input) {
    return this.practiceSessionRepository.start(userId, input);
  }
}
