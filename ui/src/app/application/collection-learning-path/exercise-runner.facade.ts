import { Injectable, inject, signal } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { ApiError } from '../../core/http/api-client.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import type {
  CompletedLearningPathExerciseOutcome,
  ExerciseContextView,
} from '../../domain/collection-learning-path/learning-path';
import { isLearningPathExerciseRepeatable } from '../../domain/collection-learning-path/learning-path';

function message(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return 'Network connection was lost. Your saved progress is safe; reconnect and try again.';
  }
  return error instanceof Error && error.message ? error.message : 'Exercise could not load.';
}

function staleProgress(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'LEARNING_PATH_PROGRESS_STALE';
}

@Injectable({ providedIn: 'root' })
export class ExerciseRunnerFacade {
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly learningStore = inject(LearningStoreService);
  private requestVersion = 0;

  readonly context = signal<ExerciseContextView | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(pathId: string, lessonId: string, exerciseId: string): Promise<boolean> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      let context = await this.api.queryExerciseContext(pathId, lessonId, exerciseId);
      if (context.state === 'available') {
        await this.api.commandStartExercise(pathId, lessonId, exerciseId, context.path.progressRevision ?? 0);
        context = await this.api.queryExerciseContext(pathId, lessonId, exerciseId);
      } else if (context.state === 'completed' && isLearningPathExerciseRepeatable(context.exercise)) {
        const practice = await this.api.commandStartExercise(
          pathId,
          lessonId,
          exerciseId,
          context.path.progressRevision ?? 0,
        );
        context = { ...context, state: practice.exerciseStatus };
      }
      if (context.exercise.type === 'vocabulary.quick-review'
        || context.exercise.completionPolicy === 'vocabulary-spelling') {
        await this.learningStore.refreshAfterSubscriptionChange();
      }
      if (request !== this.requestVersion) return false;
      this.context.set(context);
      return true;
    } catch (error) {
      if (request === this.requestVersion) {
        if (staleProgress(error)) {
          return this.reconcile(pathId, lessonId, exerciseId, request);
        }
        this.error.set(message(error));
      }
      return false;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }

  async complete(outcome: CompletedLearningPathExerciseOutcome): Promise<boolean> {
    const current = this.context();
    if (!current) return false;
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.api.commandCompleteExercise(
        current.path.id,
        current.lesson.id,
        current.exercise.id,
        outcome,
        current.path.progressRevision ?? 0,
      );
      const refreshed = await this.api.queryExerciseContext(
        current.path.id,
        current.lesson.id,
        current.exercise.id,
      );
      if (request !== this.requestVersion) return false;
      this.context.set(refreshed);
      return true;
    } catch (error) {
      if (request === this.requestVersion) {
        if (staleProgress(error)) {
          return this.reconcile(current.path.id, current.lesson.id, current.exercise.id, request);
        }
        this.error.set(message(error));
      }
      return false;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }

  private async reconcile(pathId: string, lessonId: string, exerciseId: string, request: number): Promise<boolean> {
    try {
      const refreshed = await this.api.queryExerciseContext(pathId, lessonId, exerciseId);
      if (request !== this.requestVersion) return false;
      this.context.set(refreshed);
      this.error.set(refreshed.state === 'completed'
        ? ''
        : 'Progress changed in another tab. The latest saved state has been restored; continue from here.');
      return refreshed.state === 'completed';
    } catch (error) {
      if (request === this.requestVersion) this.error.set(message(error));
      return false;
    }
  }
}
