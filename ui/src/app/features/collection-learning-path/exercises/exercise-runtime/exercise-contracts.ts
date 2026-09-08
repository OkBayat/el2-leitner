import type { Observable } from 'rxjs';
import type {
  CompletedLearningPathExerciseOutcome,
  LearningPathNodeState,
} from '../../../../domain/collection-learning-path/learning-path';

export interface ExerciseContext<TPayload = unknown> {
  readonly pathId: string;
  readonly exerciseId: string;
  readonly lessonId: string;
  readonly type: string;
  readonly schemaVersion: number;
  readonly completionPolicy?: string;
  readonly state?: LearningPathNodeState;
  readonly config: Readonly<Record<string, unknown>>;
  readonly payload: TPayload;
}

export type ExerciseOutcome = CompletedLearningPathExerciseOutcome
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: string };

export interface ExerciseComponent {
  readonly outcome: Observable<ExerciseOutcome>;
  load(context: ExerciseContext): void;
}
