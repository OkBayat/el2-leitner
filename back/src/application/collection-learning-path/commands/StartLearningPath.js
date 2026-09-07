import { findLearningPathResumePoint } from "../../../domain/collection-learning-path/LearningPathProgression.js";
import {
  ensureLearningPathProgressAccess,
  isoTimestamp,
  loadPathById,
  progressRevision,
  projectedPathForUser,
} from "../learningPathSupport.js";

export class StartLearningPath {
  constructor({
    definitionReader,
    progressReader,
    progressWriter,
    accessReader,
    transactionManager,
    clock = () => new Date(),
  }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.progressWriter = progressWriter;
    this.accessReader = accessReader;
    this.transactionManager = transactionManager;
    this.clock = clock;
  }

  async execute(userId, pathId) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathProgressAccess(this.accessReader, userId, path);
    const current = await projectedPathForUser({ progressReader: this.progressReader, userId, path });

    if (current.projected.path.learnerStatus !== "completed"
      && current.projected.path.learnerStatus !== "up_to_date") {
      const at = isoTimestamp(this.clock);
      await this.transactionManager.execute((connection) => this.progressWriter.upsertPathProgress({
        userId,
        pathId: path.id,
        status: "in_progress",
        startedAt: current.progress.path?.startedAt ?? at,
        completedAt: null,
        lastActivityAt: at,
        lastSeenContentVersion: path.contentVersion,
      }, { connection }));
    }

    const refreshed = await projectedPathForUser({ progressReader: this.progressReader, userId, path });
    return {
      pathId: path.id,
      pathStatus: refreshed.projected.path.learnerStatus,
      resumePoint: findLearningPathResumePoint(refreshed.projected),
      progressRevision: progressRevision(refreshed.progress),
    };
  }
}
