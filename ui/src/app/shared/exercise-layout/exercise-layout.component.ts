import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ExerciseHeaderComponent } from './exercise-header.component';
import {
  resolveExerciseStepHeaderMode,
  type ExerciseProgressView,
  type ExerciseStepDefinition,
} from './exercise-layout.models';

@Component({
  selector: 'app-exercise-layout',
  standalone: true,
  imports: [ExerciseHeaderComponent],
  templateUrl: './exercise-layout.component.html',
  styleUrl: './exercise-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseLayoutComponent {
  readonly step = input.required<ExerciseStepDefinition>();
  readonly progress = input<ExerciseProgressView | null>(null);
  readonly close = output<void>();
  readonly showHeader = computed(() => resolveExerciseStepHeaderMode(this.step()) === 'progress');
}
