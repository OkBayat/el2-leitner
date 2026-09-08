import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  canOpenLearningPathExercise,
  exerciseTypeLabel,
  learningPathStateLabel,
  type LearningPathExerciseView,
} from '../../../../domain/collection-learning-path/learning-path';

type ExerciseNodeKind = 'vocabulary' | 'listening' | 'shadowing' | 'practice';
type ExerciseNodeIcon = 'book' | 'review' | 'mastery' | 'headphones' | 'shadowing' | 'practice';

const EXERCISE_NODE_ICONS: Readonly<Record<string, ExerciseNodeIcon>> = {
  'vocabulary.intake': 'book',
  'vocabulary.quick-review': 'review',
  'vocabulary.mastery-check': 'mastery',
  'listening.ielts': 'headphones',
  'speaking.shadowing': 'shadowing',
};

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
  readonly label = computed(() => exerciseTypeLabel(
    this.exercise().type,
    this.exercise().config,
  ));
  readonly stateLabel = computed(() => learningPathStateLabel(this.exercise().state));
  readonly kind = computed<ExerciseNodeKind>(() => {
    const type = this.exercise().type;
    if (type.startsWith('vocabulary.')) return 'vocabulary';
    if (type.startsWith('listening.')) return 'listening';
    if (type === 'speaking.shadowing') return 'shadowing';
    return 'practice';
  });
  readonly icon = computed<ExerciseNodeIcon>(() => EXERCISE_NODE_ICONS[this.exercise().type] ?? 'practice');
  readonly actionLabel = computed(() => {
    if (this.exercise().state === 'in_progress') return 'CONTINUE';
    if (this.exercise().state === 'available') return 'START';
    return '';
  });

  open(): void {
    if (this.actionable()) this.activate.emit(this.exercise().id);
  }
}
