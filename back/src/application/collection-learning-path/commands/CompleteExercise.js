import {
  findLearningPathResumePoint,
  projectLearningPathProgress,
} from "../../../domain/collection-learning-path/LearningPathProgression.js";
import { ConflictError, ValidationError } from "../../../domain/errors.js";
import {
  ensureLearningPathProgressAccess,
  ensureProgressMutationAccepted,
  expectedProgressRevision,
  isoTimestamp,
  loadPathById,
  progressRevision,
  projectedPathForUser,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";

function completedOutcome(outcome) {
  if (!outcome || outcome.kind !== "completed") {
    throw new ValidationError(
      "INVALID_LEARNING_PATH_OUTCOME",
      "Only a completed exercise outcome can be submitted.",
    );
  }
  return outcome;
}

function progressWithCompletedExercise(progress, { exerciseId, lessonId, at, evidence }) {
  const next = structuredClone(progress ?? { path: null, lessons: [], exercises: [] });
  const exerciseIndex = next.exercises.findIndex((item) => String(item.exerciseId) === String(exerciseId));
  const previousExercise = exerciseIndex >= 0 ? next.exercises[exerciseIndex] : null;
  const exerciseProgress = {
    exerciseId,
    status: "completed",
    startedAt: previousExercise?.startedAt ?? at,
    completedAt: previousExercise?.completedAt ?? at,
    lastActivityAt: at,
    evidenceType: evidence.evidenceType,
    evidenceRef: evidence.evidenceRef,
  };
  if (exerciseIndex >= 0) next.exercises[exerciseIndex] = exerciseProgress;
  else next.exercises.push(exerciseProgress);

  const lessonIndex = next.lessons.findIndex((item) => String(item.lessonId) === String(lessonId));
  if (lessonIndex < 0) {
    next.lessons.push({
      lessonId,
      status: "in_progress",
      startedAt: at,
      completedAt: null,
      lastActivityAt: at,
    });
  }
  return next;
}

export class CompleteExercise {
  constructor({
    definitionReader,
    progressReader,
    progressWriter,
    accessReader,
    transactionManager,
    exerciseRuntime,
    clock = () => new Date(),
  }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.progressWriter = progressWriter;
    this.accessReader = accessReader;
    this.transactionManager = transactionManager;
    this.exerciseRuntime = exerciseRuntime;
    this.clock = clock;
  }

  async execute(userId, pathId, lessonId, exerciseId, rawOutcome, rawExpectedRevision = null) {
    const outcome = completedOutcome(rawOutcome);
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathProgressAccess(this.accessReader, userId, path);
    const current = await projectedPathForUser({ progressReader: this.progressReader, userId, path });
    const lesson = requireProjectedLesson(current.projected, lessonId);
    const exercise = requireProjectedExercise(lesson, exerciseId);
    const currentRevision = progressRevision(current.progress);

    if (exercise.state === "completed") {
      return {
        pathId: path.id,
        lessonId: lesson.id,
        exerciseId: exercise.id,
        exerciseStatus: "completed",
        lessonStatus: lesson.state,
        pathStatus: current.projected.path.learnerStatus,
        resumePoint: findLearningPathResumePoint(current.projected),
        progressRevision: currentRevision,
      };
    }
    if (exercise.state === "locked") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_LOCKED",
        "Exercise prerequisites are not complete.",
      );
    }
    if (exercise.progress?.status !== "in_progress") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_NOT_STARTED",
        "Start the exercise before completing it.",
      );
    }

    const expectedRevision = expectedProgressRevision(rawExpectedRevision, current.progress);
    const evidence = await this.exerciseRuntime.verifyCompletion({
      userId,
      path: current.projected.path,
      lesson,
      exercise,
      outcome,
    });
    const at = isoTimestamp(this.clock);
    const nextProgress = progressWithCompletedExercise(current.progress, {
      exerciseId: exercise.id,
      lessonId: lesson.id,
      at,
      evidence,
    });
    const nextProjected = projectLearningPathProgress(path, nextProgress);
    const nextLesson = requireProjectedLesson(nextProjected, lesson.id);
    const nextExercise = requireProjectedExercise(nextLesson, exercise.id);
    const pathStatus = nextProjected.path.learnerStatus;
    const lessonStatus = nextLesson.state === "completed" ? "completed" : "in_progress";

    await this.transactionManager.execute(async (connection) => {
      const mutation = await this.progressWriter.upsertPathProgress({
        userId,
        pathId: path.id,
        status: pathStatus,
        startedAt: current.progress.path?.startedAt ?? exercise.progress.startedAt,
        completedAt: pathStatus === "completed" ? (current.progress.path?.completedAt ?? at) : null,
        lastActivityAt: at,
        lastSeenContentVersion: path.contentVersion,
        expectedRevision,
      }, { connection });
      ensureProgressMutationAccepted(mutation);
      await this.progressWriter.upsertExerciseProgress({
        userId,
        exerciseId: exercise.id,
        status: "completed",
        startedAt: exercise.progress.startedAt,
        completedAt: at,
        lastActivityAt: at,
        evidenceType: evidence.evidenceType,
        evidenceRef: evidence.evidenceRef,
      }, { connection });
      await this.progressWriter.upsertLessonProgress({
        userId,
        lessonId: lesson.id,
        status: lessonStatus,
        startedAt: lesson.progress?.startedAt ?? exercise.progress.startedAt,
        completedAt: lessonStatus === "completed" ? (lesson.progress?.completedAt ?? at) : null,
        lastActivityAt: at,
      }, { connection });
    });

    return {
      pathId: path.id,
      lessonId: lesson.id,
      exerciseId: exercise.id,
      exerciseStatus: nextExercise.state,
      lessonStatus,
      pathStatus,
      resumePoint: findLearningPathResumePoint(nextProjected),
      progressRevision: expectedRevision + 1,
    };
  }
}
