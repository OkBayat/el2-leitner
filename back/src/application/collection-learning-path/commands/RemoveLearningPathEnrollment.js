import {
  ensureLearningPathReadAccess,
  loadPathById,
  resourcePublicId,
} from "../learningPathSupport.js";

export class RemoveLearningPathEnrollment {
  constructor({ definitionReader, progressWriter, accessReader, transactionManager }) {
    this.definitionReader = definitionReader;
    this.progressWriter = progressWriter;
    this.accessReader = accessReader;
    this.transactionManager = transactionManager;
  }

  async execute(userId, pathId) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const result = await this.transactionManager.execute((connection) => (
      this.progressWriter.removePathProgress(userId, path.id, { connection })
    ));
    return { pathId: resourcePublicId(path), removed: Boolean(result?.changed) };
  }
}
