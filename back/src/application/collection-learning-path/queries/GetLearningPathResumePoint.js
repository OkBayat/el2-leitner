import { findLearningPathResumePoint } from "../../../domain/collection-learning-path/LearningPathProgression.js";
import {
  ensureLearningPathReadAccess,
  loadPathById,
  projectedPathForUser,
  resourcePublicId,
} from "../learningPathSupport.js";

export class GetLearningPathResumePoint {
  constructor({ definitionReader, progressReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
  }

  async execute(userId, pathId) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const { projected } = await projectedPathForUser({
      progressReader: this.progressReader,
      userId,
      path,
    });
    return {
      pathId: resourcePublicId(projected.path),
      pathStatus: projected.path.learnerStatus,
      resumePoint: findLearningPathResumePoint(projected),
    };
  }
}
