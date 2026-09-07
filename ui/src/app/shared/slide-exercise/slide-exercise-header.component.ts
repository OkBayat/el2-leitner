import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { normalizeSlideExerciseProgress, type SlideExerciseProgressView } from './slide-exercise.models';

@Component({
  selector: 'app-slide-exercise-header',
  standalone: true,
  templateUrl: './slide-exercise-header.component.html',
  styleUrl: './slide-exercise-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideExerciseHeaderComponent {
  readonly progress = input<SlideExerciseProgressView | null>(null);
  readonly close = output<void>();
  readonly progressValue = computed(() => normalizeSlideExerciseProgress(this.progress()?.value ?? 0));
}
