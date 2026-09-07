import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ExerciseFeedbackTone } from './exercise-layout.models';

@Component({
  selector: 'app-exercise-footer',
  standalone: true,
  templateUrl: './exercise-footer.component.html',
  styleUrl: './exercise-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseFooterComponent {
  readonly tone = input<ExerciseFeedbackTone>('neutral');
  readonly title = input('');
  readonly detail = input('');
  readonly hasFeedback = computed(() => this.tone() !== 'neutral' || Boolean(this.title().trim()) || Boolean(this.detail().trim()));
  readonly feedbackRole = computed(() => this.tone() === 'error' ? 'alert' : 'status');
}
