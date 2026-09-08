import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { parseSlideSequenceExerciseSlides } from '../../../../domain/collection-learning-path/slide-sequence-exercise';
import {
  SlideExerciseComponent,
  type SlideExerciseActionEvent,
  type SlideExerciseSlide,
} from '../../../../shared/slide-exercise';
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
  readonly error = signal('');
  private readonly completed = signal(false);

  load(context: ExerciseContext): void {
    this.error.set('');
    this.completed.set(false);
    try {
      this.slides.set(
        parseSlideSequenceExerciseSlides(context.config) as readonly SlideExerciseSlide[],
      );
    } catch (error) {
      this.slides.set([]);
      this.error.set(message(error));
    }
  }

  onAction(event: SlideExerciseActionEvent): void {
    if (event.actionId === 'finish') this.finish(event.slideId);
  }

  finish(slideId = this.slideExercise?.currentSlide?.id ?? ''): void {
    if (this.completed()) return;
    const terminal = this.slides().at(-1);
    if (!terminal?.terminal || terminal.id !== slideId) return;
    this.completed.set(true);
    this.outcome.emit({ kind: 'completed' });
  }

  cancel(): void {
    if (!this.completed()) this.outcome.emit({ kind: 'cancelled' });
  }
}
