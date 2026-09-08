import {
  findProjectedExercise,
  findProjectedLesson,
} from "../../../domain/collection-learning-path/LearningPathProgression.js";
import { NotFoundError } from "../../../domain/errors.js";
import {
  ensureLearningPathReadAccess,
  exerciseId,
  lessonId,
  loadPathBySourceId,
  projectedPathForUser,
  resourcePublicId,
} from "../learningPathSupport.js";

export class ResolveLegacyLearningPathRoute {
  constructor({ definitionReader, progressReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
  }

  async execute(userId, pathSourceId, lessonSourceId, exerciseSourceId) {
    const path = await loadPathBySourceId(this.definitionReader, pathSourceId);
    await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const { projected } = await projectedPathForUser({
      progressReader: this.progressReader,
      userId,
      path,
    });
    const lesson = findProjectedLesson(projected, lessonId(lessonSourceId));
    const exercise = findProjectedExercise(lesson, exerciseId(exerciseSourceId));
    if (!lesson || !exercise) {
      throw new NotFoundError(
        "LEARNING_PATH_ROUTE_NOT_FOUND",
        "The legacy Learning Path route was not found.",
      );
    }
    return {
      pathId: resourcePublicId(path),
      lessonId: resourcePublicId(lesson),
      exerciseId: resourcePublicId(exercise),
    };
  }
}
