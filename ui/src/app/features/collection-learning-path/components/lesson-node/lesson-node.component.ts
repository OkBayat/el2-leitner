import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  learningPathStateLabel,
  type LearningPathExerciseSelection,
  type LearningPathLessonView,
} from '../../../../domain/collection-learning-path/learning-path';
import { ExerciseNodeComponent } from '../exercise-node/exercise-node.component';

type LessonTrailPalette = 'green' | 'purple' | 'blue' | 'orange';
const LESSON_TRAIL_PALETTES: readonly LessonTrailPalette[] = ['green', 'purple', 'blue', 'orange'];

@Component({
  selector: 'app-learning-path-lesson-node',
  standalone: true,
  imports: [RouterLink, ExerciseNodeComponent],
  templateUrl: './lesson-node.component.html',
  styleUrl: './lesson-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonNodeComponent {
  readonly pathId = input.required<string>();
  readonly lesson = input.required<LearningPathLessonView>();
  readonly startExerciseId = input<string | null>(null);
  readonly selectExercise = output<LearningPathExerciseSelection>();
  readonly active = computed(() => this.lesson().state === 'available' || this.lesson().state === 'in_progress');
  readonly mirrored = computed(() => this.lesson().position % 2 === 0);
  readonly palette = computed<LessonTrailPalette>(() => {
    const index = Math.max(0, this.lesson().position - 1) % LESSON_TRAIL_PALETTES.length;
    return LESSON_TRAIL_PALETTES[index];
  });

  stateLabel(): string {
    return learningPathStateLabel(this.lesson().state);
  }

  select(exerciseId: string): void {
    this.selectExercise.emit({ lessonId: this.lesson().id, exerciseId });
  }
}
