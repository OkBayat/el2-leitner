import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { parseSlideSequenceExercise } from '../../../../domain/collection-learning-path/slide-sequence-exercise';
import {
  createDefaultSlideContentRegistry,
  SlideExerciseComponent,
  type SlideExerciseActionEvent,
  type SlideExerciseContentEvent,
  type SlideExerciseSlide,
} from '../../../../shared/slide-exercise';
import { LessonVocabularyScopeSlideComponent } from './lesson-vocabulary-scope-slide.component';
import type {
  ExerciseComponent,
  ExerciseContext,
  ExerciseOutcome,
} from '../exercise-runtime/exercise-contracts';

function message(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'This slide sequence could not be prepared.';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

@Component({
  selector: 'app-slides-sequence-exercise',
  standalone: true,
  imports: [SlideExerciseComponent],
  templateUrl: './slides-sequence-exercise.component.html',
  styleUrl: './slides-sequence-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlidesSequenceExerciseComponent implements ExerciseComponent {
  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  @ViewChild(SlideExerciseComponent) private slideExercise?: SlideExerciseComponent;

  readonly slides = signal<readonly SlideExerciseSlide[]>([]);
  readonly runtime = signal<ExerciseContext | null>(null);
  readonly registry = (() => {
    const registry = createDefaultSlideContentRegistry();
    registry.register({
      type: 'lesson-vocabulary-scope',
      chromeDefaults: {
        header: { visible: false },
        footer: {
          primary: { id: 'start-vocabulary-scope', label: "Let's go", behavior: 'content', disabled: false },
          secondary: false,
        },
      },
      loadComponent: async () => LessonVocabularyScopeSlideComponent,
    });
    return registry;
  })();
  readonly error = signal('');
  private readonly completed = signal(false);
  private retryIncorrect = false;
  private readonly sourceSlides = new Map<string, SlideExerciseSlide>();
  private readonly retryCounts = new Map<string, number>();

  load(context: ExerciseContext): void {
    this.runtime.set(context);
    this.error.set('');
    this.completed.set(false);
    this.retryIncorrect = false;
    this.sourceSlides.clear();
    this.retryCounts.clear();
    try {
      const definition = parseSlideSequenceExercise(context.config);
      const slides = definition.slides as readonly SlideExerciseSlide[];
      this.retryIncorrect = definition.retryIncorrect;
      this.slides.set(slides);
      slides.filter((slide) => !slide.terminal).forEach((slide) => {
        this.sourceSlides.set(slide.id, slide);
      });
    } catch (error) {
      this.slides.set([]);
      this.error.set(message(error));
    }
  }

  onAction(event: SlideExerciseActionEvent): void {
    if (event.actionId === 'finish') this.finish(event.slideId);
  }

  onContentEvent(event: SlideExerciseContentEvent): void {
    if (!this.retryIncorrect || event.type !== 'answered') return;
    const result = event.data;
    if (!result || typeof result !== 'object' || Array.isArray(result)
      || (result as Record<string, unknown>)['correct'] !== false) return;
    const deck = this.slideExercise;
    const current = deck?.currentSlide;
    if (!current || current.id !== event.slideId) return;
    const rootId = current.rootSlideId?.trim() || current.id;
    const source = this.sourceSlides.get(rootId)
      ?? deck.deck.find((slide) => slide.id === rootId);
    if (!source) return;
    const retryNumber = (this.retryCounts.get(rootId) ?? 0) + 1;
    this.retryCounts.set(rootId, retryNumber);
    deck.deckController.insertSlides({
      anchorId: current.id,
      gap: 2,
      slides: [{
        ...source,
        id: `${rootId}-retry-${retryNumber}`,
        rootSlideId: rootId,
        retryNumber,
        terminal: false,
      }],
    });
  }

  finish(slideId = this.slideExercise?.currentSlide?.id ?? ''): void {
    if (this.completed()) return;
    const terminal = this.slides().at(-1);
    if (!terminal?.terminal || terminal.id !== slideId
      || this.slideExercise?.currentSlide?.id !== slideId) return;
    const results = this.slideExercise.deckController.results().flatMap((result) => {
      const data = record(result.data);
      const status = result.eventType === 'submitted'
        ? 'submitted'
        : data?.['correct'] === true
          ? 'correct'
          : data?.['correct'] === false
            ? 'incorrect'
            : null;
      return status ? [{
        rootSlideId: result.rootSlideId,
        slideType: result.slideType,
        itemId: result.itemId,
        status,
      }] : [];
    });
    this.completed.set(true);
    this.outcome.emit({ kind: 'completed', evidence: { schemaVersion: 1, results } });
  }

  cancel(): void {
    if (!this.completed()) this.outcome.emit({ kind: 'cancelled' });
  }
}
