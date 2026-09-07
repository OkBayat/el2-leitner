import { Injectable, inject, signal } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { CollectionLearningPathView, LearningPathResumeView } from '../../domain/collection-learning-path/learning-path';

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function resumeFromView(view: CollectionLearningPathView): LearningPathResumeView {
  return {
    pathId: view.path.id,
    pathStatus: view.path.learnerStatus,
    resumePoint: view.resumePoint,
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionLearningPathFacade {
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly library = inject(LibraryApiService);
  private requestVersion = 0;

  readonly view = signal<CollectionLearningPathView | null>(null);
  readonly resume = signal<LearningPathResumeView | null>(null);
  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly error = signal('');

  async load(collectionId: string): Promise<boolean> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const view = await this.api.queryCollectionLearningPath(collectionId);
      if (request !== this.requestVersion) return false;
      this.view.set(view);
      this.resume.set(resumeFromView(view));
      return true;
    } catch (error) {
      if (request === this.requestVersion) this.error.set(message(error, 'Learning Path could not load.'));
      return false;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }

  async start(): Promise<boolean> {
    const current = this.view();
    if (!current || this.starting()) return false;
    const { path } = current;
    this.starting.set(true);
    this.error.set('');
    try {
      if (!current.access.canProgress) {
        await this.library.subscribe(path.collectionId);
      }
      const resume = await this.api.commandStartPath(path.id);
      const refreshed = await this.api.queryCollectionLearningPath(path.collectionId);
      if (this.view()?.path.id !== path.id) return false;
      this.resume.set(resume);
      this.view.set(refreshed);
      return true;
    } catch (error) {
      this.error.set(message(error, 'Learning Path could not start.'));
      return false;
    } finally {
      this.starting.set(false);
    }
  }
}
