export class LearningPathIeltsListeningReader {
  async getPublishedTest(_reference) {
    throw new Error("LearningPathIeltsListeningReader.getPublishedTest must be implemented.");
  }

  async findSubmittedAttempt(_userId, _attemptId) {
    throw new Error("LearningPathIeltsListeningReader.findSubmittedAttempt must be implemented.");
  }
}
