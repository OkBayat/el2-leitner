export class LearningPathDefinitionWriter {
  async upsertPath(_path, _options = {}) {
    throw new Error("LearningPathDefinitionWriter.upsertPath must be implemented");
  }

  async retirePath(_pathPublicId, _retirement, _options = {}) {
    throw new Error("LearningPathDefinitionWriter.retirePath must be implemented");
  }

  async upsertLesson(_pathPublicId, _lesson, _options = {}) {
    throw new Error("LearningPathDefinitionWriter.upsertLesson must be implemented");
  }

  async upsertExercise(_lessonPublicId, _exercise, _options = {}) {
    throw new Error("LearningPathDefinitionWriter.upsertExercise must be implemented");
  }

  async retireLesson(_lessonPublicId, _retirement, _options = {}) {
    throw new Error("LearningPathDefinitionWriter.retireLesson must be implemented");
  }

  async retireExercise(_exercisePublicId, _retirement, _options = {}) {
    throw new Error("LearningPathDefinitionWriter.retireExercise must be implemented");
  }
}
