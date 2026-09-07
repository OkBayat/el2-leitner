import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ExerciseRunnerFacade } from '../../../application/collection-learning-path/exercise-runner.facade';
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
        void this.facade.load(state.pathId, state.lessonId, state.exerciseId);
      }
    });
  }

  retry(): void {
    const state = this.routeState();
    if (state) void this.facade.load(state.pathId, state.lessonId, state.exerciseId);
  }

  onExerciseOutcome(outcome: ExerciseOutcome): void {
    if (outcome.kind === 'completed') {
      void this.facade.complete(outcome);
      return;
    }
    if (outcome.kind === 'cancelled') {
      const context = this.facade.context();
      if (context) void this.router.navigate(['/library', context.path.collectionId, 'learning-path']);
    }
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
