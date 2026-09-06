import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  canOpenLearningPathExercise,
  exerciseTypeLabel,
  learningPathStateLabel,
  type LearningPathExerciseView,
} from '../../../../domain/collection-learning-path/learning-path';

@Component({
  selector: 'app-learning-path-exercise-node',
  standalone: true,
  templateUrl: './exercise-node.component.html',
  styleUrl: './exercise-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseNodeComponent {
  readonly exercise = input.required<LearningPathExerciseView>();
  readonly activate = output<string>();
  readonly actionable = computed(() => canOpenLearningPathExercise(this.exercise()));
  readonly label = computed(() => exerciseTypeLabel(this.exercise().type));
  readonly stateLabel = computed(() => learningPathStateLabel(this.exercise().state));

  open(): void {
    if (this.actionable()) this.activate.emit(this.exercise().id);
  }
}
