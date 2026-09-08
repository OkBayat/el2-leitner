export class LearningPathAccessReader {
  async getForCollection(_userId, _collectionPublicId) {
    throw new Error("LearningPathAccessReader.getForCollection must be implemented");
  }
}
