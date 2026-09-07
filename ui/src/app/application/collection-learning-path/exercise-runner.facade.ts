import { Injectable, inject, signal } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import type {
  CompletedLearningPathExerciseOutcome,
  ExerciseContextView,
  LearningPathResumeView,
} from '../../domain/collection-learning-path/learning-path';

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Exercise could not load.';
}

@Injectable({ providedIn: 'root' })
export class ExerciseRunnerFacade {
  private readonly api = inject(CollectionLearningPathApiService);
  private requestVersion = 0;

  readonly context = signal<ExerciseContextView | null>(null);
  readonly resume = signal<LearningPathResumeView | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(pathId: string, lessonId: string, exerciseId: string): Promise<boolean> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    this.resume.set(null);
    try {
      let context = await this.api.queryExerciseContext(pathId, lessonId, exerciseId);
      if (context.state === 'available') {
        await this.api.commandStartExercise(pathId, lessonId, exerciseId);
        context = await this.api.queryExerciseContext(pathId, lessonId, exerciseId);
      }
      const resume = context.state === 'completed'
        ? await this.api.queryResumePoint(pathId)
        : null;
      if (request !== this.requestVersion) return false;
      this.context.set(context);
      this.resume.set(resume);
      return true;
    } catch (error) {
      if (request === this.requestVersion) this.error.set(message(error));
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
      const completion = await this.api.commandCompleteExercise(
        current.path.id,
        current.lesson.id,
        current.exercise.id,
        outcome,
      );
      const refreshed = await this.api.queryExerciseContext(
        current.path.id,
        current.lesson.id,
        current.exercise.id,
      );
      if (request !== this.requestVersion) return false;
      this.context.set(refreshed);
      this.resume.set({
        pathId: completion.pathId,
        pathStatus: completion.pathStatus,
        resumePoint: completion.resumePoint,
      });
      return true;
    } catch (error) {
      if (request === this.requestVersion) this.error.set(message(error));
      return false;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }
}
