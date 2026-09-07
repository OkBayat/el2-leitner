import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { normalizeExerciseProgress, type ExerciseProgressView } from './exercise-layout.models';

@Component({
  selector: 'app-exercise-header',
  standalone: true,
  templateUrl: './exercise-header.component.html',
  styleUrl: './exercise-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseHeaderComponent {
  readonly progress = input<ExerciseProgressView | null>(null);
  readonly close = output<void>();
  readonly progressValue = computed(() => normalizeExerciseProgress(this.progress()?.value ?? 0));
}
