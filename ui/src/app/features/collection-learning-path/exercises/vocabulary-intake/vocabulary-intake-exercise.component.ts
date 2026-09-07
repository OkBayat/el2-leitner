import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { VocabularyIntakeFacade } from '../../../../application/collection-learning-path/vocabulary-intake.facade';
import { parseVocabularyIntakePayload } from '../../../../domain/collection-learning-path/vocabulary-intake';
import type { VocabularyIntakePayload } from '../../../../domain/collection-learning-path/vocabulary-intake';
import {
  SlideExerciseComponent,
  type MultipleChoiceAnswerEvent,
  type SlideExerciseActionEvent,
  type SlideExerciseChromeConfig,
  type SlideExerciseContentEvent,
  type SlideExerciseSlide,
} from '../../../../shared/slide-exercise';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';
import {
  buildVocabularyIntakeSlides,
  firstVocabularyIntakePracticeSlideId,
  VOCABULARY_INTAKE_INTRO_SLIDE_ID,
  withVocabularyIntakeScore,
} from './vocabulary-intake-slide.factory';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Vocabulary could not be added to Box 1.';
}

function answerEvent(value: unknown): MultipleChoiceAnswerEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<MultipleChoiceAnswerEvent>;
  if (typeof source.correct !== 'boolean') return null;
  if (typeof source.selectedOptionId !== 'string' || typeof source.correctOptionId !== 'string') return null;
  return {
    selectedOptionId: source.selectedOptionId,
    correctOptionId: source.correctOptionId,
    correct: source.correct,
  };
}

@Component({
  selector: 'app-vocabulary-intake-exercise',
  standalone: true,
  imports: [SlideExerciseComponent],
  templateUrl: './vocabulary-intake-exercise.component.html',
  styleUrl: './vocabulary-intake-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyIntakeExerciseComponent implements ExerciseComponent {
  private readonly facade = inject(VocabularyIntakeFacade);
  private readonly runtime = signal<ExerciseContext | null>(null);
  private readonly answeredSlides = new Set<string>();

  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  @ViewChild(SlideExerciseComponent) private slideExercise?: SlideExerciseComponent;

  readonly payload = signal<VocabularyIntakePayload | null>(null);
  readonly slides = signal<readonly SlideExerciseSlide[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly correctCount = signal(0);
  readonly incorrectCount = signal(0);
  readonly chromeDefaults = computed<SlideExerciseChromeConfig>(() => {
    if (this.busy()) {
      return { footer: { primary: { disabled: true, loading: true } } };
    }
    if (this.error()) {
      return {
        footer: {
          tone: 'error',
          title: 'Could not start practice',
          detail: this.error(),
        },
      };
    }
    return {};
  });

  load(context: ExerciseContext): void {
    this.runtime.set(context);
    this.busy.set(false);
    this.error.set('');
    this.correctCount.set(0);
    this.incorrectCount.set(0);
    this.answeredSlides.clear();
    try {
      const payload = parseVocabularyIntakePayload(context.payload);
      this.payload.set(payload);
      this.slides.set(buildVocabularyIntakeSlides(payload));
    } catch (error) {
      this.payload.set(null);
      this.slides.set([]);
      this.error.set(errorMessage(error));
    }
  }

  onAction(event: SlideExerciseActionEvent): void {
    if (event.slideId === VOCABULARY_INTAKE_INTRO_SLIDE_ID && event.actionId === 'start-practice') {
      void this.startPractice();
    }
  }

  async startPractice(): Promise<void> {
    const context = this.runtime();
    const slides = this.slides();
    if (!context || !slides.length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.facade.activate(context.pathId, context.lessonId, context.exerciseId);
      this.slideExercise?.goTo(firstVocabularyIntakePracticeSlideId(slides));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  onContentEvent(event: SlideExerciseContentEvent): void {
    if (event.type !== 'answered' || this.answeredSlides.has(event.slideId)) return;
    const answer = answerEvent(event.data);
    if (!answer) return;
    this.answeredSlides.add(event.slideId);
    if (answer.correct) this.correctCount.update((count) => count + 1);
    else this.incorrectCount.update((count) => count + 1);
    this.slides.update((slides) => withVocabularyIntakeScore(
      slides,
      this.correctCount(),
      this.incorrectCount(),
    ));
  }

  cancel(): void {
    this.outcome.emit({ kind: 'cancelled' });
  }

  complete(): void {
    this.outcome.emit({ kind: 'completed' });
  }
}
