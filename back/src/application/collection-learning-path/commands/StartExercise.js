import { ConflictError } from "../../../domain/errors.js";
import { isLearningPathExerciseRepeatable } from "../../../domain/collection-learning-path/LearningPathProgression.js";
import {
  ensureLearningPathProgressAccess,
  ensureProgressMutationAccepted,
  expectedProgressRevision,
  isoTimestamp,
  loadPathById,
  progressRevision,
  projectedPathForUser,
  resourcePublicId,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";

export class StartExercise {
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

  async execute(userId, pathId, lessonId, exerciseId, rawExpectedRevision = null) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathProgressAccess(this.accessReader, userId, path);
    const current = await projectedPathForUser({ progressReader: this.progressReader, userId, path });
    const lesson = requireProjectedLesson(current.projected, lessonId);
    const exercise = requireProjectedExercise(lesson, exerciseId);
    const currentRevision = progressRevision(current.progress);

    if (exercise.state === "completed") {
      return {
        pathId: resourcePublicId(path),
        lessonId: resourcePublicId(lesson),
        exerciseId: resourcePublicId(exercise),
        exerciseStatus: isLearningPathExerciseRepeatable(exercise) ? "in_progress" : "completed",
        progressRevision: currentRevision,
      };
    }
    if (exercise.progress?.status === "in_progress") {
      return {
        pathId: resourcePublicId(path),
        lessonId: resourcePublicId(lesson),
        exerciseId: resourcePublicId(exercise),
        exerciseStatus: "in_progress",
        progressRevision: currentRevision,
      };
    }
    if (exercise.state === "locked") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_LOCKED",
        "Exercise prerequisites are not complete.",
      );
    }

    const expectedRevision = expectedProgressRevision(rawExpectedRevision, current.progress);
    const at = isoTimestamp(this.clock);
    const pathStatus = current.projected.path.learnerStatus === "completed"
      || current.projected.path.learnerStatus === "up_to_date"
      ? current.projected.path.learnerStatus
      : "in_progress";
    const lessonStatus = lesson.state === "completed" ? "completed" : "in_progress";

    await this.transactionManager.execute(async (connection) => {
      const mutation = await this.progressWriter.upsertPathProgress({
        userId,
        pathId: path.id,
        status: pathStatus,
        startedAt: current.progress.path?.startedAt ?? at,
        completedAt: current.progress.path?.completedAt ?? null,
        lastActivityAt: at,
        lastSeenContentVersion: path.contentVersion,
        expectedRevision,
      }, { connection });
      ensureProgressMutationAccepted(mutation);
      await this.progressWriter.upsertLessonProgress({
        userId,
        lessonId: lesson.id,
        status: lessonStatus,
        startedAt: lesson.progress?.startedAt ?? at,
        completedAt: lesson.progress?.completedAt ?? null,
        lastActivityAt: at,
      }, { connection });
      await this.progressWriter.upsertExerciseProgress({
        userId,
        exerciseId: exercise.id,
        status: "in_progress",
        startedAt: exercise.progress?.startedAt ?? at,
        completedAt: null,
        lastActivityAt: at,
        evidenceType: null,
        evidenceRef: null,
      }, { connection });
    });

    return {
      pathId: resourcePublicId(path),
      lessonId: resourcePublicId(lesson),
      exerciseId: resourcePublicId(exercise),
      exerciseStatus: "in_progress",
      progressRevision: expectedRevision + 1,
    };
  }
}
