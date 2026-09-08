export class LearningPathProgressWriter {
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
