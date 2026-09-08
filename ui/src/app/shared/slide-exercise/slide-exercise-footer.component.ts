import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SlideExerciseFeedbackTone } from './slide-exercise.models';

@Component({
  selector: 'app-slide-exercise-footer',
  standalone: true,
  templateUrl: './slide-exercise-footer.component.html',
  styleUrl: './slide-exercise-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideExerciseFooterComponent {
  readonly tone = input<SlideExerciseFeedbackTone>('neutral');
  readonly title = input('');
  readonly detail = input('');
  readonly hasFeedback = computed(() => this.tone() !== 'neutral' || Boolean(this.title().trim()) || Boolean(this.detail().trim()));
  readonly feedbackRole = computed(() => this.tone() === 'error' ? 'alert' : 'status');
}
