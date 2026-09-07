import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { resolveSlideExerciseActionState, type SlideExerciseActionTone } from './slide-exercise.models';

@Component({
  selector: 'app-slide-exercise-action',
  standalone: true,
  templateUrl: './slide-exercise-action.component.html',
  styleUrl: './slide-exercise-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideExerciseActionComponent {
  readonly tone = input<SlideExerciseActionTone>('primary');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly ariaLabel = input('');
  readonly pressed = output<void>();
  readonly state = computed(() => resolveSlideExerciseActionState(this.tone(), this.disabled(), this.loading()));

  activate(): void {
    if (this.state() === 'disabled') return;
    this.pressed.emit();
  }
}
