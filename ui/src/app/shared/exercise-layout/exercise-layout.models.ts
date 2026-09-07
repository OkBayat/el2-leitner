export type ExerciseStepKind = 'introduction' | 'practice' | 'summary' | 'custom';
export type ExerciseHeaderMode = 'progress' | 'hidden';
export type ExerciseFeedbackTone = 'neutral' | 'success' | 'information' | 'warning' | 'error';
export type ExerciseActionTone = 'primary' | 'secondary' | 'success' | 'information' | 'warning' | 'error';
export type ExerciseActionState = ExerciseActionTone | 'disabled';

export interface ExerciseProgressView {
  readonly value: number;
  readonly label?: string;
  readonly detail?: string;
}

export interface ExerciseStepDefinition {
  readonly id: string;
  readonly kind: ExerciseStepKind;
  readonly headerMode?: ExerciseHeaderMode;
}

export interface ExerciseFlowDefinition {
  readonly before?: readonly ExerciseStepDefinition[];
  readonly practice: ExerciseStepDefinition;
  readonly summary?: ExerciseStepDefinition;
  readonly after?: readonly ExerciseStepDefinition[];
}

export interface ExerciseSummaryMetric {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

export function buildExerciseStepSequence(definition: ExerciseFlowDefinition): readonly ExerciseStepDefinition[] {
  if (definition.practice.kind !== 'practice') {
    throw new Error('Exercise practice step must use the practice kind.');
  }
  if (definition.summary && definition.summary.kind !== 'summary') {
    throw new Error('Exercise summary step must use the summary kind.');
  }

  const steps = [
    ...(definition.before ?? []),
    definition.practice,
    ...(definition.summary ? [definition.summary] : []),
    ...(definition.after ?? []),
  ];
  const ids = steps.map((step) => step.id.trim());
  if (ids.some((id) => !id)) throw new Error('Exercise step ids are required.');
  if (new Set(ids).size !== ids.length) throw new Error('Exercise step ids must be unique.');
  return steps;
}

export function resolveExerciseStepHeaderMode(step: ExerciseStepDefinition): ExerciseHeaderMode {
  return step.headerMode ?? (step.kind === 'summary' ? 'hidden' : 'progress');
}

export function normalizeExerciseProgress(value: number): number {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

export function resolveExerciseActionState(
  tone: ExerciseActionTone,
  disabled: boolean,
  loading: boolean,
): ExerciseActionState {
  return disabled || loading ? 'disabled' : tone;
}
