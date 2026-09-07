function progressDto(progress) {
  if (!progress) return null;
  return {
    status: progress.status,
    startedAt: progress.startedAt,
    completedAt: progress.completedAt ?? null,
    lastActivityAt: progress.lastActivityAt,
  };
}

function resumePointDto(resumePoint) {
  if (!resumePoint) return null;
  return {
    lessonId: resumePoint.lessonId,
    exerciseId: resumePoint.exerciseId,
  };
}

export function exerciseDto(exercise) {
  return {
    id: exercise.id,
    position: exercise.position,
    type: exercise.type,
    schemaVersion: exercise.schemaVersion,
    required: exercise.required,
    completionPolicy: exercise.completionPolicy,
    config: exercise.config ?? {},
    state: exercise.state,
    progress: progressDto(exercise.progress),
  };
}

export function lessonDto(lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    position: lesson.position,
    sourceKind: lesson.sourceKind ?? null,
    sourceRef: lesson.sourceRef ?? null,
    state: lesson.state,
    progress: progressDto(lesson.progress),
    exercises: (lesson.exercises ?? []).map(exerciseDto),
  };
}

export function pathDto(path) {
  return {
    id: path.id,
    collectionId: path.collectionId,
    title: path.title,
    mode: path.mode,
    status: path.status,
    contentVersion: path.contentVersion,
    learnerStatus: path.learnerStatus,
    progress: path.progress ? {
      ...progressDto(path.progress),
      lastSeenContentVersion: path.progress.lastSeenContentVersion,
      revision: Number(path.progress.revision ?? 0),
    } : null,
  };
}

export function collectionLearningPathDto(view) {
  return {
    access: { canProgress: Boolean(view.access?.canProgress) },
    resumePoint: resumePointDto(view.resumePoint),
    path: pathDto(view.path),
    lessons: (view.lessons ?? []).map(lessonDto),
  };
}

export function exerciseContextDto(context) {
  const progressRevision = context.path.progress?.revision;
  return {
    path: {
      id: context.path.id,
      collectionId: context.path.collectionId,
      title: context.path.title,
      mode: context.path.mode,
      contentVersion: context.path.contentVersion,
      ...(progressRevision == null ? {} : { progressRevision: Number(progressRevision) }),
    },
    lesson: {
      id: context.lesson.id,
      title: context.lesson.title,
      position: context.lesson.position,
    },
    exercise: {
      id: context.exercise.id,
      position: context.exercise.position,
      type: context.exercise.type,
      schemaVersion: context.exercise.schemaVersion,
      required: context.exercise.required,
      completionPolicy: context.exercise.completionPolicy,
      config: context.exercise.config ?? {},
    },
    progress: progressDto(context.progress),
    state: context.state,
    payload: context.payload ?? null,
  };
}
