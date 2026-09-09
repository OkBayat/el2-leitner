import { Injectable, inject, signal } from '@angular/core';
import {
  CollectionLearningPathApiService,
  normalizeLearningPathCatalog,
} from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';

export type SelectedCourse = LibraryCollection & { learningPathId: string | null };

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Courses could not load.';
}

function byTitle(left: LibraryCollection, right: LibraryCollection): number {
  return left.title.localeCompare(right.title);
}

export function courseMenuCollections(
  collections: readonly LibraryCollection[],
  learningPathIds: ReadonlyMap<string, string>,
  enrolledCollectionIds: ReadonlySet<string> = new Set(),
): SelectedCourse[] {
  const courses = collections.flatMap((collection) => {
    if (!enrolledCollectionIds.has(collection.id)) return [];
    return [{ ...collection, learningPathId: learningPathIds.get(collection.id) ?? null }];
  });
  return courses.sort(byTitle);
}

@Injectable({ providedIn: 'root' })
export class SelectedCoursesFacade {
  private readonly library = inject(LibraryApiService);
  private readonly learningPaths = inject(CollectionLearningPathApiService);
  private requestVersion = 0;

  readonly courses = signal<SelectedCourse[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(): Promise<boolean> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const [result, learningPathCollections] = await Promise.all([
        this.library.list(),
        this.learningPaths.queryLearningPathCollectionIds(),
      ]);
      if (request !== this.requestVersion) return false;
      const collections = result.collections ?? [];
      const summaries = normalizeLearningPathCatalog(learningPathCollections, collections);
      const learningPathIds = new Map(
        summaries.flatMap((item) => item.pathId ? [[item.collectionId, item.pathId] as const] : []),
      );
      const enrolledCollectionIds = new Set(
        summaries.filter((item) => item.enrolled).map((item) => item.collectionId),
      );
      this.courses.set(courseMenuCollections(
        collections,
        learningPathIds,
        enrolledCollectionIds,
      ));
      return true;
    } catch (error) {
      if (request === this.requestVersion) this.error.set(errorMessage(error));
      return false;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }
}
