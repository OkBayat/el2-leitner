import { vocabularyIntakeReadyForCompletion } from "../../../domain/collection-learning-path/VocabularyIntake.js";
import { ConflictError } from "../../../domain/errors.js";
import {
  ensureLearningPathProgressAccess,
  isoTimestamp,
  loadPathById,
  projectedPathForUser,
  resourcePublicId,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";
import { loadVocabularyIntakePayload } from "../vocabularyIntakeSupport.js";

export class ActivateVocabularyIntake {
  constructor({
    definitionReader,
    progressReader,
    accessReader,
    vocabularyIntakeReader,
    vocabularyIntakeWriter,
    clock = () => new Date(),
  }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
    this.vocabularyIntakeReader = vocabularyIntakeReader;
    this.vocabularyIntakeWriter = vocabularyIntakeWriter;
    this.clock = clock;
  }

  async execute(userId, pathId, lessonId, exerciseId) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathProgressAccess(this.accessReader, userId, path);
    const current = await projectedPathForUser({ progressReader: this.progressReader, userId, path });
    const lesson = requireProjectedLesson(current.projected, lessonId);
    const exercise = requireProjectedExercise(lesson, exerciseId);

    if (exercise.state === "locked") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_LOCKED",
        "Exercise prerequisites are not complete.",
      );
    }
    if (exercise.state === "completed") {
      const payload = await loadVocabularyIntakePayload(this.vocabularyIntakeReader, userId, exercise);
      return {
        pathId: resourcePublicId(path),
        lessonId: resourcePublicId(lesson),
        exerciseId: resourcePublicId(exercise),
        exerciseStatus: "completed",
        activatedCount: 0,
        revision: null,
        summary: payload.summary,
      };
    }
    if (exercise.progress?.status !== "in_progress") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_NOT_STARTED",
        "Start the exercise before activating its vocabulary.",
      );
    }

    const before = await loadVocabularyIntakePayload(this.vocabularyIntakeReader, userId, exercise);
    const day = isoTimestamp(this.clock).slice(0, 10);
    const write = await this.vocabularyIntakeWriter.activateUnseen(userId, {
      vocabularyIds: before.items.map((item) => item.id),
      day,
      source: "learning-path",
    });
    const after = await loadVocabularyIntakePayload(this.vocabularyIntakeReader, userId, exercise);
    if (!vocabularyIntakeReadyForCompletion(after)) {
      throw new ConflictError(
        "LEARNING_PATH_VOCABULARY_INTAKE_INCOMPLETE",
        "Some vocabulary items could not be activated. Reload and try again.",
      );
    }
    return {
      pathId: resourcePublicId(path),
      lessonId: resourcePublicId(lesson),
      exerciseId: resourcePublicId(exercise),
      exerciseStatus: "in_progress",
      activatedCount: Number(write?.activatedCount ?? 0),
      revision: write?.revision ?? null,
      summary: after.summary,
    };
  }
}
