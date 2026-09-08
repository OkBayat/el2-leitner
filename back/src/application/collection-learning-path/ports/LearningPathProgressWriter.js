export class LearningPathProgressWriter {
  async removePathProgress(_userId, _pathId, _options = {}) {
    throw new Error("LearningPathProgressWriter.removePathProgress must be implemented");
  }

  async upsertPathProgress(_progress, _options = {}) {
    throw new Error("LearningPathProgressWriter.upsertPathProgress must be implemented");
  }

  async upsertLessonProgress(_progress, _options = {}) {
    throw new Error("LearningPathProgressWriter.upsertLessonProgress must be implemented");
  }

  async upsertExerciseProgress(_progress, _options = {}) {
    throw new Error("LearningPathProgressWriter.upsertExerciseProgress must be implemented");
  }
}
