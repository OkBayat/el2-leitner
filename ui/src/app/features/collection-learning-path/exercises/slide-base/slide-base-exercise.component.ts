import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { parseSlideBaseExerciseSlides } from '../../../../domain/collection-learning-path/slide-base-exercise';
import {
  createDefaultSlideContentRegistry,
  SlideExerciseComponent,
  type SlideExerciseActionEvent,
  type SlideExerciseChromeConfig,
  type SlideExerciseSlide,
} from '../../../../shared/slide-exercise';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';
import { LeitnerHouseOneScopeSlideComponent } from '../vocabulary-spelling/leitner-house-one-scope-slide.component';
import { SlideBaseExerciseSessionService } from './slide-base-exercise-session.service';

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'This slide exercise could not be prepared.';
}

@Component({
  selector: 'app-slide-base-exercise',
  standalone: true,
  imports: [SlideExerciseComponent],
  providers: [SlideBaseExerciseSessionService],
  templateUrl: './slide-base-exercise.component.html',
  styleUrl: './slide-base-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideBaseExerciseComponent implements ExerciseComponent {
  private readonly session: SlideBaseExerciseSessionService;
  readonly runtime = signal<ExerciseContext | null>(null);
  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  @ViewChild(SlideExerciseComponent) private slideExercise?: SlideExerciseComponent;

  readonly registry = (() => {
    const registry = createDefaultSlideContentRegistry();
    registry.register({
      type: 'leitner-house-one-scope',
      chromeDefaults: {
        header: { visible: false },
        footer: {
          primary: { id: 'start-spelling', label: "Let's go", behavior: 'content', disabled: true },
          secondary: false,
        },
      },
      loadComponent: async () => LeitnerHouseOneScopeSlideComponent,
    });
    return registry;
  })();
  readonly slides = signal<readonly SlideExerciseSlide[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly chromeDefaults = computed<SlideExerciseChromeConfig>(() => this.busy()
    ? { footer: { primary: { disabled: true, loading: true } } }
    : this.error()
      ? { footer: { tone: 'error', title: 'Could not continue', detail: this.error() } }
      : {});

  constructor(session: SlideBaseExerciseSessionService) {
    this.session = session;
  }

  load(context: ExerciseContext): void {
    this.runtime.set(context);
    this.busy.set(false);
    this.error.set('');
    try {
      this.slides.set(parseSlideBaseExerciseSlides(context.config) as readonly SlideExerciseSlide[]);
    } catch (error) {
      this.slides.set([]);
      this.error.set(message(error));
    }
  }

  onAction(event: SlideExerciseActionEvent): void {
    if (event.actionId === 'finish') void this.finish();
  }

  async finish(): Promise<void> {
    const context = this.runtime();
    if (!context || !this.slideExercise || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const completed = await this.session.complete(
        context.completionPolicy ?? '',
        this.slideExercise.results(),
      );
      this.outcome.emit(completed);
    } catch (error) {
      this.error.set(message(error));
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(): Promise<void> {
    await this.session.abandon();
    this.outcome.emit({ kind: 'cancelled' });
  }
}
