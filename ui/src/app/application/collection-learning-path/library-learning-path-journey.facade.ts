import { Injectable, inject, signal } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';
import type { CollectionLearningPathView, LearningPathResumePoint } from '../../domain/collection-learning-path/learning-path';

export type LearningPathJourneyDestination =
  | { kind: 'exercise'; pathId: string; lessonId: string; exerciseId: string }
  | { kind: 'path'; collectionId: string };

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Course could not open.';
}

function exerciseDestination(pathId: string, resumePoint: LearningPathResumePoint): LearningPathJourneyDestination {
  return {
    kind: 'exercise',
    pathId,
    lessonId: resumePoint.lessonId,
    exerciseId: resumePoint.exerciseId,
  };
}

@Injectable({ providedIn: 'root' })
export class LibraryLearningPathJourneyFacade {
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly library = inject(LibraryApiService);
  private readonly views = signal<ReadonlyMap<string, CollectionLearningPathView>>(new Map());
  private requestVersion = 0;

  readonly loading = signal(false);
  readonly enteringId = signal<string | null>(null);
  readonly error = signal('');

  viewFor(collectionId: string): CollectionLearningPathView | null {
    return this.views().get(collectionId) ?? null;
  }

  async load(collections: readonly Pick<LibraryCollection, 'id' | 'kind'>[]): Promise<boolean> {
    const request = ++this.requestVersion;
    const candidates = collections.filter((collection) => collection.kind === 'course');
    this.loading.set(true);
    this.error.set('');
    try {
      const results = await Promise.all(candidates.map(async (collection) => {
        try {
          return [collection.id, await this.api.queryCollectionLearningPath(collection.id)] as const;
        } catch {
          return null;
        }
      }));
      if (request !== this.requestVersion) return false;
      this.views.set(new Map(results.filter((result): result is readonly [string, CollectionLearningPathView] => result !== null)));
      return true;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }

  async enter(collection: Pick<LibraryCollection, 'id'>): Promise<LearningPathJourneyDestination | null> {
    const current = this.viewFor(collection.id);
    if (!current || this.enteringId()) return null;
    this.enteringId.set(collection.id);
    this.error.set('');
    try {
      const { path } = current;
      if (path.learnerStatus === 'completed' || path.learnerStatus === 'up_to_date') {
        return { kind: 'path', collectionId: collection.id };
      }

      if (!current.access.canProgress) {
        await this.library.subscribe(collection.id);
      }

      let resumePoint = current.resumePoint;
      if (path.learnerStatus === 'available') {
        const started = await this.api.commandStartPath(path.id);
        resumePoint = started.resumePoint;
      } else if (!resumePoint) {
        resumePoint = (await this.api.queryResumePoint(path.id)).resumePoint;
      }

      return resumePoint
        ? exerciseDestination(path.id, resumePoint)
        : { kind: 'path', collectionId: collection.id };
    } catch (error) {
      this.error.set(errorMessage(error));
      return null;
    } finally {
      this.enteringId.set(null);
    }
  }
}
