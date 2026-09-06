import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  learningPathStateLabel,
  type LearningPathExerciseSelection,
  type LearningPathLessonView,
} from '../../../../domain/collection-learning-path/learning-path';
import { ExerciseNodeComponent } from '../exercise-node/exercise-node.component';

@Component({
  selector: 'app-learning-path-lesson-node',
  standalone: true,
  imports: [ExerciseNodeComponent],
  templateUrl: './lesson-node.component.html',
  styleUrl: './lesson-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonNodeComponent {
  readonly lesson = input.required<LearningPathLessonView>();
  readonly selectExercise = output<LearningPathExerciseSelection>();

  stateLabel(): string {
    return learningPathStateLabel(this.lesson().state);
  }

  select(exerciseId: string): void {
    this.selectExercise.emit({ lessonId: this.lesson().id, exerciseId });
  }
}
