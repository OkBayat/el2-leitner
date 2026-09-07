import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ExerciseSummaryMetric } from './exercise-layout.models';

@Component({
  selector: 'app-exercise-summary',
  standalone: true,
  templateUrl: './exercise-summary.component.html',
  styleUrl: './exercise-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseSummaryComponent {
  readonly eyebrow = input('Exercise complete');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly metrics = input<readonly ExerciseSummaryMetric[]>([]);
}
