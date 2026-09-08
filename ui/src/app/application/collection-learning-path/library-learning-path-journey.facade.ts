import { Injectable, inject, signal } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';
import type { CollectionLearningPathView, LearningPathResumePoint } from '../../domain/collection-learning-path/learning-path';

export type LearningPathJourneyDestination =
  | { kind: 'exercise'; pathId: string; lessonId: string; exerciseId: string }
  | { kind: 'path'; pathId: string; collectionId: string };
type LearningPathOverviewDestination = Extract<LearningPathJourneyDestination, { kind: 'path' }>;

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

  async load(collections: readonly Pick<LibraryCollection, 'id'>[]): Promise<boolean> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const results = await Promise.all(collections.map(async (collection) => {
        try {
          return [collection.id, await this.api.queryCollectionLearningPath(collection.id)] as const;
        } catch {
          return null;
        }
      }));
      if (request !== this.requestVersion) return false;
      const available = results.filter((result): result is readonly [string, CollectionLearningPathView] => result !== null);
      this.views.set(new Map(available));
      if (available.length !== results.length) {
        this.error.set('Some courses could not load. Open a course to try again.');
        return false;
      }
      return true;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }

  async enter(collection: Pick<LibraryCollection, 'id'>): Promise<LearningPathJourneyDestination | null> {
    if (this.enteringId()) return null;
    this.enteringId.set(collection.id);
    this.error.set('');
    try {
      const current = await this.loadView(collection.id);
      const { path } = current;
      if (path.learnerStatus === 'completed' || path.learnerStatus === 'up_to_date') {
        return { kind: 'path', pathId: path.id, collectionId: collection.id };
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
        : { kind: 'path', pathId: path.id, collectionId: collection.id };
    } catch (error) {
      this.error.set(errorMessage(error));
      return null;
    } finally {
      this.enteringId.set(null);
    }
  }

  async openOverview(collection: Pick<LibraryCollection, 'id'>): Promise<LearningPathOverviewDestination | null> {
    if (this.enteringId()) return null;
    this.enteringId.set(collection.id);
    this.error.set('');
    try {
      const current = await this.loadView(collection.id);
      return {
        kind: 'path',
        pathId: current.path.id,
        collectionId: current.path.collectionId,
      };
    } catch (error) {
      this.error.set(errorMessage(error));
      return null;
    } finally {
      this.enteringId.set(null);
    }
  }

  private async loadView(collectionId: string): Promise<CollectionLearningPathView> {
    const loaded = this.viewFor(collectionId);
    if (loaded) return loaded;
    const current = await this.api.queryCollectionLearningPath(collectionId);
    this.views.update((views) => new Map(views).set(collectionId, current));
    return current;
  }
}
