import {
  ensureLearningPathReadAccess,
  loadPathById,
  projectedPathForUser,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";

export class GetExerciseContext {
  constructor({ definitionReader, progressReader, accessReader, exerciseRuntime }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
    this.exerciseRuntime = exerciseRuntime;
  }

  async execute(userId, pathId, lessonId, exerciseId) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const { projected } = await projectedPathForUser({
      progressReader: this.progressReader,
      userId,
      path,
    });
    const lesson = requireProjectedLesson(projected, lessonId);
    const exercise = requireProjectedExercise(lesson, exerciseId);
    const payload = await this.exerciseRuntime.hydrate({
      userId,
      path: projected.path,
      lesson,
      exercise,
    });
    return {
      path: projected.path,
      lesson,
      exercise,
      progress: exercise.progress,
      state: exercise.state,
      payload,
    };
  }
}
