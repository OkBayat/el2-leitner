import type { Signal } from '@angular/core';
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

export type PronunciationPracticePhase =
  | 'loading'
  | 'load-error'
  | 'empty'
  | 'ready'
  | 'requesting'
  | 'recording'
  | 'processing'
  | 'evaluation-error'
  | 'feedback'
  | 'complete';

export interface PronunciationPracticeAssessment {
  readonly transcript: string;
  readonly matchedCount: number;
  readonly totalCount: number;
  readonly score: number;
  readonly passed: boolean;
}

export interface PronunciationPracticeController {
  readonly supported: boolean;
  readonly phase: Signal<PronunciationPracticePhase>;
  readonly levels: Signal<readonly number[]>;
  readonly seconds: Signal<number>;
  readonly assessment: Signal<PronunciationPracticeAssessment | null>;
  readonly result: Signal<PronunciationPracticeAssessment | null>;
  readonly error: Signal<string>;
  selectPrompt(itemId: string, promptId: string): boolean;
  record(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
}

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
