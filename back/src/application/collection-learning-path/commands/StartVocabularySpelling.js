import {
  VOCABULARY_SPELLING_SESSION_MODE,
  createVocabularySpellingPayload,
  createVocabularySpellingSessionMetadata,
  parseVocabularySpellingScope,
  resolveVocabularySpellingDefinition,
  vocabularySpellingItemsForScope,
} from "../../../domain/collection-learning-path/VocabularySpellingPractice.js";
import { ConflictError, ValidationError } from "../../../domain/errors.js";
import {
  ensureLearningPathProgressAccess,
  loadPathById,
  projectedPathForUser,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";

async function loadStartedExercise({ definitionReader, progressReader, accessReader, userId, pathId, lessonId, exerciseId }) {
  const path = await loadPathById(definitionReader, pathId);
  await ensureLearningPathProgressAccess(accessReader, userId, path);
  const current = await projectedPathForUser({ progressReader, userId, path });
  const lesson = requireProjectedLesson(current.projected, lessonId);
  const exercise = requireProjectedExercise(lesson, exerciseId);
  if (exercise.state === "locked") {
    throw new ConflictError("LEARNING_PATH_EXERCISE_LOCKED", "Exercise prerequisites are not complete.");
  }
  if (exercise.progress?.status !== "in_progress") {
    throw new ConflictError(
      "LEARNING_PATH_EXERCISE_NOT_STARTED",
      "Start the exercise before starting its spelling practice.",
    );
  }
  return { path: current.projected.path, lesson, exercise };
}

export class StartVocabularySpelling {
  constructor({
    definitionReader,
    progressReader,
    accessReader,
    spellingReader,
    practiceSessionWriter,
    loadStartedExercise: exerciseLoader = loadStartedExercise,
  }) {
    this.dependencies = { definitionReader, progressReader, accessReader };
    this.spellingReader = spellingReader;
    this.practiceSessionWriter = practiceSessionWriter;
    this.loadStartedExercise = exerciseLoader;
  }

  async execute(userId, pathId, lessonId, exerciseId, rawScope) {
    const scope = parseVocabularySpellingScope(rawScope);
    if (!scope) throw new ValidationError("INVALID_VOCABULARY_SPELLING_SCOPE", "Spelling scope must be course or all.");
    const context = await this.loadStartedExercise({
      ...this.dependencies,
      userId,
      pathId,
      lessonId,
      exerciseId,
    });
    const definition = resolveVocabularySpellingDefinition(context.path, context.exercise);
    const vocabulary = await this.spellingReader.findForCourseAndLearner(userId, definition.collectionId);
    const completePayload = createVocabularySpellingPayload(definition.collectionId, vocabulary?.items ?? []);
    const items = vocabularySpellingItemsForScope(completePayload, scope);
    const payload = {
      scope,
      items,
      summary: { box: 1, eligibleCount: items.length },
    };
    const response = {
      pathId: context.path.id,
      lessonId: context.lesson.id,
      exerciseId: context.exercise.id,
      payload,
    };
    if (!items.length) return { ...response, session: null };

    const vocabularyIds = items.map((item) => item.id);
    const metadata = createVocabularySpellingSessionMetadata({
      ...context,
      scope,
      aggregationMode: definition.aggregationMode,
      vocabularyIds,
    });
    const session = await this.practiceSessionWriter.start(userId, {
      mode: VOCABULARY_SPELLING_SESSION_MODE,
      plannedCount: vocabularyIds.length,
      metadata,
    });
    return { ...response, session };
  }
}
