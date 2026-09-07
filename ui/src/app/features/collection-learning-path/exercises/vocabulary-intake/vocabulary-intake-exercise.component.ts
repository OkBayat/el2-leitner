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
import {
  parseVocabularyIntakePayload,
  vocabularyIntakeStateLabel,
} from '../../../../domain/collection-learning-path/vocabulary-intake';
import type {
  VocabularyIntakeItem,
  VocabularyIntakePayload,
} from '../../../../domain/collection-learning-path/vocabulary-intake';
import {
  SlideExerciseComponent,
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

const CAMBRIDGE_VOCABULARY_PATH_ID = 'cvfi-learning-path';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Vocabulary could not be activated.';
}

interface ChoiceAnswerEvent {
  readonly selectedOptionIds: readonly string[];
  readonly correctOptionIds: readonly string[];
  readonly correct: boolean;
}

function answerEvent(value: unknown): ChoiceAnswerEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<ChoiceAnswerEvent>;
  if (typeof source.correct !== 'boolean') return null;
  if (!Array.isArray(source.selectedOptionIds) || !Array.isArray(source.correctOptionIds)) return null;
  if (source.selectedOptionIds.some((id) => typeof id !== 'string') || source.correctOptionIds.some((id) => typeof id !== 'string')) return null;
  return {
    selectedOptionIds: source.selectedOptionIds,
    correctOptionIds: source.correctOptionIds,
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
  readonly slideMode = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly correctCount = signal(0);
  readonly incorrectCount = signal(0);
  readonly buttonLabel = computed(() => {
    const count = this.payload()?.summary.newCount ?? 0;
    return count > 0 ? `Add ${count} new word${count === 1 ? '' : 's'}` : 'Continue';
  });
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
    this.slideMode.set(context.pathId === CAMBRIDGE_VOCABULARY_PATH_ID);
    this.busy.set(false);
    this.error.set('');
    this.correctCount.set(0);
    this.incorrectCount.set(0);
    this.answeredSlides.clear();
    try {
      const payload = parseVocabularyIntakePayload(context.payload);
      this.payload.set(payload);
      this.slides.set(this.slideMode() ? buildVocabularyIntakeSlides(payload) : []);
    } catch (error) {
      this.payload.set(null);
      this.slides.set([]);
      this.error.set(errorMessage(error));
    }
  }

  stateLabel(item: VocabularyIntakeItem): string {
    return vocabularyIntakeStateLabel(item);
  }

  onAction(event: SlideExerciseActionEvent): void {
    if (event.slideId === VOCABULARY_INTAKE_INTRO_SLIDE_ID && event.actionId === 'start-practice') {
      void this.startPractice();
    }
  }

  async startPractice(): Promise<void> {
    const context = this.runtime();
    const slides = this.slides();
    if (!this.slideMode() || !context || !slides.length || this.busy()) return;
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

  async finish(): Promise<void> {
    const context = this.runtime();
    if (this.slideMode() || !context || !this.payload() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.facade.activate(context.pathId, context.lessonId, context.exerciseId);
      this.outcome.emit({ kind: 'completed' });
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
