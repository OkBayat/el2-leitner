import { findLearningPathResumePoint } from "../../../domain/collection-learning-path/LearningPathProgression.js";
import {
  ensureLearningPathReadAccess,
  loadPathById,
  projectedPathForUser,
} from "../learningPathSupport.js";

export class GetLearningPath {
  constructor({ definitionReader, progressReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
  }

  async execute(userId, pathId) {
    const path = await loadPathById(this.definitionReader, pathId);
    const access = await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const { projected } = await projectedPathForUser({
      progressReader: this.progressReader,
      userId,
      path,
    });
    return {
      ...projected,
      access: { canProgress: Boolean(access.canProgress) },
      resumePoint: findLearningPathResumePoint(projected),
    };
  }
}
