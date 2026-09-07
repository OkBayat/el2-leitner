import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { resolveExerciseActionState, type ExerciseActionTone } from './exercise-layout.models';

@Component({
  selector: 'app-exercise-action',
  standalone: true,
  templateUrl: './exercise-action.component.html',
  styleUrl: './exercise-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseActionComponent {
  readonly tone = input<ExerciseActionTone>('primary');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly ariaLabel = input('');
  readonly pressed = output<void>();
  readonly state = computed(() => resolveExerciseActionState(this.tone(), this.disabled(), this.loading()));

  activate(): void {
    if (this.state() === 'disabled') return;
    this.pressed.emit();
  }
}
