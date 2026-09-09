import type { Observable } from 'rxjs';
import type {
  SlideExerciseDeckController,
  SlideExerciseRuntimeState,
  SlideExerciseSlide,
} from './slide-exercise.models';

export interface SelectionSlideExpansionRequest {
  readonly expansionId: string;
  readonly slideId: string;
  readonly selectedOptionIds: readonly string[];
}

export interface SelectionSlideExpansionResult {
  readonly slides: readonly SlideExerciseSlide[];
}

export type SelectionSlideExpansionHandler = (
  request: SelectionSlideExpansionRequest,
) => SelectionSlideExpansionResult | Promise<SelectionSlideExpansionResult>;

export interface SlideContentContext<TData = unknown> {
  readonly slideId: string;
  readonly type: string;
  readonly data: TData;
  readonly environment?: unknown;
  readonly deck?: SlideExerciseDeckController;
}

export interface SlideContentEvent<TData = unknown> {
  readonly type: string;
  readonly data?: TData;
}

export interface SlideContentComponent {
  readonly stateChange?: Observable<SlideExerciseRuntimeState>;
  readonly event?: Observable<SlideContentEvent>;
  load(context: SlideContentContext): void;
  handleAction?(actionId: string): void;
  handleShortcut?(key: string): void;
}
