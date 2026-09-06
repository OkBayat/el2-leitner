import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ExerciseRunnerFacade } from '../../../application/collection-learning-path/exercise-runner.facade';
import { exerciseTypeLabel, learningPathStateLabel } from '../../../domain/collection-learning-path/learning-path';
import type { ExerciseOutcome } from '../exercises/exercise-runtime/exercise-contracts';
import { ExerciseHostComponent } from '../exercises/exercise-runtime/exercise-host.component';

interface RunnerRoute {
  pathId: string;
  lessonId: string;
  exerciseId: string;
}

@Component({
  selector: 'app-learning-path-exercise-runner-page',
  standalone: true,
  imports: [RouterLink, ExerciseHostComponent],
  templateUrl: './exercise-runner-page.component.html',
  styleUrl: './exercise-runner-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseRunnerPageComponent {
  readonly facade = inject(ExerciseRunnerFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeState = signal<RunnerRoute | null>(null);
  readonly exerciseLabel = computed(() => this.facade.context() ? exerciseTypeLabel(this.facade.context()!.exercise.type) : 'Exercise');
  readonly stateLabel = computed(() => this.facade.context() ? learningPathStateLabel(this.facade.context()!.state) : '');
  readonly backLink = computed(() => {
    const collectionId = this.facade.context()?.path.collectionId;
    return collectionId ? ['/library', collectionId, 'learning-path'] : ['/library'];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state: RunnerRoute = {
        pathId: params.get('pathId')?.trim() ?? '',
        lessonId: params.get('lessonId')?.trim() ?? '',
        exerciseId: params.get('exerciseId')?.trim() ?? '',
      };
      this.routeState.set(state);
      if (state.pathId && state.lessonId && state.exerciseId) {
        void this.facade.load(state.pathId, state.lessonId, state.exerciseId);
      }
    });
  }

  retry(): void {
    const state = this.routeState();
    if (state) void this.facade.load(state.pathId, state.lessonId, state.exerciseId);
  }

  onExerciseOutcome(outcome: ExerciseOutcome): void {
    if (outcome.kind === 'completed') void this.facade.complete(outcome);
  }

  continueJourney(): void {
    const context = this.facade.context();
    const resumePoint = this.facade.resume()?.resumePoint;
    if (!context) return;
    if (resumePoint) {
      void this.router.navigate([
        '/learning-path', context.path.id, 'lessons', resumePoint.lessonId, 'exercises', resumePoint.exerciseId,
      ]);
      return;
    }
    void this.router.navigate(['/library', context.path.collectionId, 'learning-path']);
  }
}
