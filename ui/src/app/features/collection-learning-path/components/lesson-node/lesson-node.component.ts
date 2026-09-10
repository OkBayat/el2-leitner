import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  type LearningPathExerciseSelection,
  type LearningPathLessonView,
} from '../../../../domain/collection-learning-path/learning-path';
import { ExerciseNodeComponent } from '../exercise-node/exercise-node.component';
import { lessonTrailPalette, type LessonTrailPalette } from '../lesson-palette';

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
  readonly startExerciseId = input<string | null>(null);
  readonly selectExercise = output<LearningPathExerciseSelection>();
  readonly mirrored = computed(() => this.lesson().position % 2 === 0);
  readonly palette = computed<LessonTrailPalette>(() => lessonTrailPalette(this.lesson().position));

  select(exerciseId: string): void {
    this.selectExercise.emit({ lessonId: this.lesson().id, exerciseId });
  }
}
