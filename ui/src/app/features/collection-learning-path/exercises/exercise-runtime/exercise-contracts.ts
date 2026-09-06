export type ExerciseStatus = 'completed' | 'failed' | 'cancelled';

export interface ExerciseContext {
  readonly exerciseId: string;
  readonly lessonId: string;
  readonly type: string;
  readonly schemaVersion: number;
  readonly config: Record<string, unknown>;
}

export interface ExerciseOutcome {
  readonly status: ExerciseStatus;
  readonly evidence?: Record<string, unknown>;
}

export interface ExerciseComponent {
  load(context: ExerciseContext): void;
}
