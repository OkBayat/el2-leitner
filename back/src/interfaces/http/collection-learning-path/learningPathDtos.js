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

function identityDto(resource) {
  if (resource.publicId == null) return { id: resource.id };
  return { id: String(resource.publicId) };
}

export function exerciseDto(exercise) {
  return {
    ...identityDto(exercise),
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
    ...identityDto(lesson),
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
    ...identityDto(path),
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
      ...identityDto(context.path),
      collectionId: context.path.collectionId,
      title: context.path.title,
      mode: context.path.mode,
      contentVersion: context.path.contentVersion,
      ...(progressRevision == null ? {} : { progressRevision: Number(progressRevision) }),
    },
    lesson: {
      ...identityDto(context.lesson),
      title: context.lesson.title,
      position: context.lesson.position,
    },
    exercise: {
      ...identityDto(context.exercise),
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
