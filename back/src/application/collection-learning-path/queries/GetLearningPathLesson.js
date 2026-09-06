import {
  ensureLearningPathReadAccess,
  loadPathById,
  projectedPathForUser,
  requireProjectedLesson,
} from "../learningPathSupport.js";

export class GetLearningPathLesson {
  constructor({ definitionReader, progressReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
  }

  async execute(userId, pathId, lessonId) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const { projected } = await projectedPathForUser({
      progressReader: this.progressReader,
      userId,
      path,
    });
    return requireProjectedLesson(projected, lessonId);
  }
}
