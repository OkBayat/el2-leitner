const EMPTY_PROGRESS = Object.freeze({ path: null, lessons: [], exercises: [] });

function byPosition(left, right) {
  const difference = Number(left.position) - Number(right.position);
  return difference || String(left.id).localeCompare(String(right.id));
}

function published(items = []) {
  return items.filter((item) => item.status === "published" && item.retiredAt == null).sort(byPosition);
}

function progressMaps(progress) {
  const source = progress ?? EMPTY_PROGRESS;
  return {
    lessons: new Map((source.lessons ?? []).map((item) => [String(item.lessonId), item])),
    exercises: new Map((source.exercises ?? []).map((item) => [String(item.exerciseId), item])),
  };
}

function exerciseHasCompleted(progress) {
  return progress?.status === "completed" || progress?.completedAt != null;
}

export function isLearningPathExerciseRepeatable(exercise) {
  return exercise?.config?.repeatable !== false;
}

function requiredExercisesComplete(exercises, exerciseProgress) {
  return exercises
    .filter((exercise) => exercise.required)
    .every((exercise) => exerciseHasCompleted(exerciseProgress.get(String(exercise.id))));
}

function publicExercise(exercise, progress, state) {
  return {
    ...exercise,
    progress: progress ?? null,
    state,
  };
}

function publicLesson(lesson, progress, state, exercises) {
  return {
    ...lesson,
    progress: progress ?? null,
    state,
    exercises,
  };
}

export function projectLearningPathProgress(path, progress = EMPTY_PROGRESS) {
  const maps = progressMaps(progress);
  const lessons = published(path.lessons).map((lesson) => ({
    ...lesson,
    exercises: published(lesson.exercises),
  }));

  const lessonCompletion = new Map();
  for (const lesson of lessons) {
    lessonCompletion.set(
      String(lesson.id),
      maps.lessons.get(String(lesson.id))?.status === "completed"
        || requiredExercisesComplete(lesson.exercises, maps.exercises),
    );
  }

  const projectedLessons = [];
  let previousLessonsComplete = true;

  for (const lesson of lessons) {
    const lessonId = String(lesson.id);
    const lessonProgress = maps.lessons.get(lessonId) ?? null;
    const lessonIsComplete = lessonCompletion.get(lessonId) === true;
    let lessonState;
    if (lessonIsComplete) lessonState = "completed";
    else if (!previousLessonsComplete) lessonState = "locked";
    else if (lessonProgress?.status === "in_progress") lessonState = "in_progress";
    else lessonState = "available";

    const projectedExercises = [];
    let previousRequiredExercisesComplete = true;
    for (const exercise of lesson.exercises) {
      const exerciseProgress = maps.exercises.get(String(exercise.id)) ?? null;
      let exerciseState;
      if (exerciseHasCompleted(exerciseProgress)) {
        exerciseState = "completed";
      } else if (!previousLessonsComplete || !previousRequiredExercisesComplete) {
        exerciseState = "locked";
      } else if (exerciseProgress?.status === "in_progress") {
        exerciseState = "in_progress";
      } else {
        exerciseState = "available";
      }
      projectedExercises.push(publicExercise(exercise, exerciseProgress, exerciseState));
      if (exercise.required && !exerciseHasCompleted(exerciseProgress)) {
        previousRequiredExercisesComplete = false;
      }
    }

    projectedLessons.push(publicLesson(lesson, lessonProgress, lessonState, projectedExercises));
    previousLessonsComplete = previousLessonsComplete && lessonIsComplete;
  }

  const allPublishedLessonsComplete = projectedLessons.length > 0
    && projectedLessons.every((lesson) => lesson.state === "completed");
  let learnerStatus;
  if (allPublishedLessonsComplete) {
    learnerStatus = path.mode === "rolling" ? "up_to_date" : "completed";
  } else if (progress?.path) {
    learnerStatus = "in_progress";
  } else {
    learnerStatus = "available";
  }

  return {
    path: {
      ...path,
      learnerStatus,
      progress: progress?.path ?? null,
    },
    lessons: projectedLessons,
  };
}

export function findLearningPathResumePoint(projectedPath) {
  for (const lesson of projectedPath.lessons) {
    if (lesson.state === "completed" || lesson.state === "locked") continue;
    const exercise = lesson.exercises.find(
      (candidate) => candidate.state === "available" || candidate.state === "in_progress",
    );
    if (exercise) {
      return {
        lessonId: String(lesson.publicId ?? lesson.id),
        exerciseId: String(exercise.publicId ?? exercise.id),
      };
    }
  }
  return null;
}

export function findProjectedLesson(projectedPath, lessonId) {
  return projectedPath.lessons.find((lesson) => String(lesson.id) === String(lessonId)) ?? null;
}

export function findProjectedExercise(projectedLesson, exerciseId) {
  return projectedLesson?.exercises.find(
    (exercise) => String(exercise.id) === String(exerciseId),
  ) ?? null;
}
