import type { Observable } from 'rxjs';
import type { SlideExerciseRuntimeState } from './slide-exercise.models';

export interface SlideContentContext<TData = unknown> {
  readonly slideId: string;
  readonly type: string;
  readonly data: TData;
}

export interface SlideContentComponent {
  readonly stateChange?: Observable<SlideExerciseRuntimeState>;
  load(context: SlideContentContext): void;
  handleAction?(actionId: string): void;
}
