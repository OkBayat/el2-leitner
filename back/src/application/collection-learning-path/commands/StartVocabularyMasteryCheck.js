import {
  VOCABULARY_MASTERY_CHECK_SESSION_MODE,
  createVocabularyMasteryCheckSessionMetadata,
} from "../../../domain/collection-learning-path/VocabularyMasteryCheck.js";
import { ConflictError } from "../../../domain/errors.js";
import {
  ensureLearningPathProgressAccess,
  loadPathById,
  projectedPathForUser,
  resourcePublicId,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";
import { loadVocabularyMasteryCheckPayload } from "../vocabularyMasteryCheckSupport.js";

function randomOrder(items) {
  const ordered = [...items];
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  }
  return ordered;
}

export class StartVocabularyMasteryCheck {
  constructor({
    definitionReader,
    progressReader,
    accessReader,
    scopedVocabularyReader,
    masteryCheckSessionWriter,
    orderVocabulary = randomOrder,
  }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
    this.scopedVocabularyReader = scopedVocabularyReader;
    this.masteryCheckSessionWriter = masteryCheckSessionWriter;
    this.orderVocabulary = orderVocabulary;
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
    if (exercise.progress?.status !== "in_progress") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_NOT_STARTED",
        "Start the exercise before starting its mastery check.",
      );
    }

    const currentPayload = await loadVocabularyMasteryCheckPayload(this.scopedVocabularyReader, userId, exercise);
    const orderedItems = this.orderVocabulary(currentPayload.items);
    const payload = {
      scope: currentPayload.scope,
      items: orderedItems,
      summary: { eligibleCount: orderedItems.length },
    };
    if (orderedItems.length === 0) {
      return {
        pathId: resourcePublicId(path),
        lessonId: resourcePublicId(lesson),
        exerciseId: resourcePublicId(exercise),
        session: null,
        payload,
      };
    }

    const vocabularyIds = orderedItems.map((item) => item.id);
    const metadata = createVocabularyMasteryCheckSessionMetadata(exercise, payload.scope, vocabularyIds);
    const session = await this.masteryCheckSessionWriter.start(userId, {
      mode: VOCABULARY_MASTERY_CHECK_SESSION_MODE,
      plannedCount: vocabularyIds.length,
      metadata,
    });

    return {
      pathId: resourcePublicId(path),
      lessonId: resourcePublicId(lesson),
      exerciseId: resourcePublicId(exercise),
      session,
      payload,
    };
  }
}
