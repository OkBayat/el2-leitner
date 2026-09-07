export type LearningPathMode = 'finite' | 'rolling';
export type LearningPathLearnerStatus = 'available' | 'in_progress' | 'completed' | 'up_to_date';
export type LearningPathNodeState = 'locked' | 'available' | 'in_progress' | 'completed';

export interface LearningPathProgressView {
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
}

export interface LearningPathPathProgressView extends LearningPathProgressView {
  lastSeenContentVersion: string | null;
}

export interface LearningPathExerciseView {
  id: string;
  position: number;
  type: string;
  schemaVersion: number;
  required: boolean;
  completionPolicy: string;
  config: Readonly<Record<string, unknown>>;
  state: LearningPathNodeState;
  progress: LearningPathProgressView | null;
}

export interface LearningPathLessonView {
  id: string;
  title: string;
  position: number;
  sourceKind: string | null;
  sourceRef: string | null;
  state: LearningPathNodeState;
  progress: LearningPathProgressView | null;
  exercises: LearningPathExerciseView[];
}

export interface LearningPathPathView {
  id: string;
  collectionId: string;
  title: string;
  mode: LearningPathMode;
  status: string;
  contentVersion: string;
  learnerStatus: LearningPathLearnerStatus;
  progress: LearningPathPathProgressView | null;
}

export interface LearningPathResumePoint {
  lessonId: string;
  exerciseId: string;
}

export interface CollectionLearningPathView {
  access: { canProgress: boolean };
  resumePoint: LearningPathResumePoint | null;
  path: LearningPathPathView;
  lessons: LearningPathLessonView[];
}

export interface LearningPathResumeView {
  pathId: string;
  pathStatus: LearningPathLearnerStatus;
  resumePoint: LearningPathResumePoint | null;
}

export interface CompletedLearningPathExerciseOutcome {
  kind: 'completed';
  evidence?: Readonly<Record<string, unknown>>;
}

export interface LearningPathExerciseCompletionView {
  pathId: string;
  lessonId: string;
  exerciseId: string;
  exerciseStatus: LearningPathNodeState;
  lessonStatus: string;
  pathStatus: LearningPathLearnerStatus;
  resumePoint: LearningPathResumePoint | null;
}

export interface ExerciseContextView {
  path: {
    id: string;
    collectionId: string;
    title: string;
    mode: LearningPathMode;
    contentVersion: string;
  };
  lesson: {
    id: string;
    title: string;
    position: number;
  };
  exercise: Omit<LearningPathExerciseView, 'state' | 'progress'>;
  progress: LearningPathProgressView | null;
  state: LearningPathNodeState;
  payload: unknown;
}

export interface LearningPathExerciseSelection {
  lessonId: string;
  exerciseId: string;
}

export interface LearningPathSummary {
  completedLessons: number;
  totalLessons: number;
  completedRequiredExercises: number;
  totalRequiredExercises: number;
  percent: number;
}

export interface LearningPathPrimaryAction {
  label: string;
  actionable: boolean;
}

export function summarizeLearningPath(lessons: readonly LearningPathLessonView[]): LearningPathSummary {
  const requiredExercises = lessons.flatMap((lesson) => lesson.exercises.filter((exercise) => exercise.required));
  const completedRequiredExercises = requiredExercises.filter((exercise) => exercise.state === 'completed').length;
  return {
    completedLessons: lessons.filter((lesson) => lesson.state === 'completed').length,
    totalLessons: lessons.length,
    completedRequiredExercises,
    totalRequiredExercises: requiredExercises.length,
    percent: requiredExercises.length === 0 ? 0 : Math.round((completedRequiredExercises / requiredExercises.length) * 100),
  };
}

export function canOpenLearningPathExercise(exercise: Pick<LearningPathExerciseView, 'state'>): boolean {
  return exercise.state === 'available' || exercise.state === 'in_progress';
}

export function learningPathStateLabel(state: LearningPathNodeState): string {
  return {
    locked: 'Locked',
    available: 'Ready',
    in_progress: 'In progress',
    completed: 'Completed',
  }[state];
}

export function learningPathStatusLabel(status: LearningPathLearnerStatus): string {
  return {
    available: 'Ready to start',
    in_progress: 'In progress',
    completed: 'Completed',
    up_to_date: 'Up to date',
  }[status];
}

export function learningPathPrimaryAction(status: LearningPathLearnerStatus): LearningPathPrimaryAction {
  return {
    available: { label: 'Start course', actionable: true },
    in_progress: { label: 'Continue', actionable: true },
    completed: { label: 'Completed', actionable: false },
    up_to_date: { label: 'Up to date', actionable: false },
  }[status];
}

const EXERCISE_LABELS: Readonly<Record<string, string>> = {
  'vocabulary.intake': 'Vocabulary intake',
  'vocabulary.quick-review': 'Quick vocabulary review',
  'vocabulary.mastery-check': 'Vocabulary mastery check',
  'listening.ielts': 'IELTS listening',
  'speaking.shadowing': 'Shadowing',
};

export function exerciseTypeLabel(type: string): string {
  const known = EXERCISE_LABELS[type];
  if (known) return known;
  const leaf = type.split('.').filter(Boolean).at(-1) || 'Exercise';
  const words = leaf.replace(/[-_]+/gu, ' ').trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : 'Exercise';
}
