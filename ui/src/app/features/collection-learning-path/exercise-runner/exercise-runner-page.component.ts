import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ExerciseRunnerFacade } from '../../../application/collection-learning-path/exercise-runner.facade';
import { learningPathOverviewRoute } from '../../../domain/collection-learning-path/learning-path';
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
  imports: [ExerciseHostComponent],
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

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state: RunnerRoute = {
        pathId: params.get('pathId')?.trim() ?? '',
        lessonId: params.get('lessonId')?.trim() ?? '',
        exerciseId: params.get('exerciseId')?.trim() ?? '',
      };
      this.routeState.set(state);
      if (state.pathId && state.lessonId && state.exerciseId) {
        void this.loadExercise(state);
      }
    });
  }

  retry(): void {
    const state = this.routeState();
    if (state) void this.loadExercise(state);
  }

  async onExerciseOutcome(outcome: ExerciseOutcome): Promise<void> {
    if (outcome.kind === 'completed') {
      if (await this.facade.complete(outcome)) {
        await this.returnToLearningPath();
      }
      return;
    }
    if (outcome.kind === 'cancelled') {
      await this.returnToLearningPath();
    }
  }

  private async loadExercise(state: RunnerRoute): Promise<void> {
    if (await this.facade.load(state.pathId, state.lessonId, state.exerciseId)
      && this.facade.context()?.state === 'completed') {
      await this.returnToLearningPath();
    }
  }

  private async returnToLearningPath(): Promise<void> {
    const context = this.facade.context();
    if (!context) return;
    await this.router.navigate(learningPathOverviewRoute(context.path.id, context.path.collectionId));
  }
}
