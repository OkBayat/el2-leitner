import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CollectionLearningPathFacade } from '../../../application/collection-learning-path/collection-learning-path.facade';
import { learningPathPrimaryAction } from '../../../domain/collection-learning-path/learning-path';
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
  readonly primaryAction = computed(() => {
    const status = this.facade.view()?.path.learnerStatus;
    return status ? learningPathPrimaryAction(status) : { label: 'Continue', actionable: false };
  });
  readonly continueLabel = computed(() => this.primaryAction().label);
  readonly canContinue = computed(() => this.primaryAction().actionable
    && Boolean(this.facade.resume()?.resumePoint)
    && !this.facade.loading()
    && !this.facade.starting());

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

  async continuePath(): Promise<void> {
    const path = this.facade.view()?.path;
    if (!path || !this.canContinue()) return;
    if (path.learnerStatus === 'available' && !await this.facade.start()) return;
    const resumePoint = this.facade.resume()?.resumePoint;
    if (!resumePoint) return;
    await this.router.navigate(['/learning-path', path.id, 'lessons', resumePoint.lessonId, 'exercises', resumePoint.exerciseId]);
  }

  async openExercise(selection: LearningPathExerciseSelection): Promise<void> {
    const pathId = this.facade.view()?.path.id;
    if (!pathId) return;
    await this.router.navigate(['/learning-path', pathId, 'lessons', selection.lessonId, 'exercises', selection.exerciseId]);
  }
}
