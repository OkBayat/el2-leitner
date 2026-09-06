import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  learningPathStatusLabel,
  summarizeLearningPath,
  type LearningPathLessonView,
  type LearningPathPathView,
} from '../../../../domain/collection-learning-path/learning-path';

@Component({
  selector: 'app-learning-path-progress-header',
  standalone: true,
  templateUrl: './progress-header.component.html',
  styleUrl: './progress-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressHeaderComponent {
  readonly path = input.required<LearningPathPathView>();
  readonly lessons = input.required<LearningPathLessonView[]>();
  readonly summary = computed(() => summarizeLearningPath(this.lessons()));
  readonly statusLabel = computed(() => learningPathStatusLabel(this.path().learnerStatus));
}
