import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CollectionLearningPathFacade } from '../../../application/collection-learning-path/collection-learning-path.facade';
import type { LearningPathExerciseSelection } from '../../../domain/collection-learning-path/learning-path';
import { LessonNodeComponent } from '../components/lesson-node/lesson-node.component';
import { ProgressHeaderComponent } from '../components/progress-header/progress-header.component';

@Component({
  selector: 'app-learning-path-page',
  standalone: true,
  imports: [RouterLink, ProgressHeaderComponent, LessonNodeComponent],
  templateUrl: './learning-path-page.component.html',
  styleUrl: './learning-path-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningPathPageComponent {
  readonly facade = inject(CollectionLearningPathFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly collectionId = signal('');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const collectionId = params.get('collectionId')?.trim() ?? '';
      this.collectionId.set(collectionId);
      if (collectionId) void this.facade.load(collectionId);
    });
  }

  retry(): void {
    if (this.collectionId()) void this.facade.load(this.collectionId());
  }

  async openExercise(selection: LearningPathExerciseSelection): Promise<void> {
    const path = this.facade.view()?.path;
    if (!path) return;

    if (path.learnerStatus === 'available') {
      if (this.facade.starting() || !await this.facade.start()) return;
    }

    await this.router.navigate(['/learning-path', path.id, 'lessons', selection.lessonId, 'exercises', selection.exerciseId]);
  }
}
