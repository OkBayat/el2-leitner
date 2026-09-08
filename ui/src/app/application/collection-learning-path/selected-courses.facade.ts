import { Injectable, inject, signal } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';

const INITIAL_COURSE_SLUG = 'bbc-six-minute-english';

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
  availableCollectionIds: ReadonlySet<string> = new Set(learningPathIds.keys()),
): SelectedCourse[] {
  const courses = collections.flatMap((collection) => {
    if (!availableCollectionIds.has(collection.id) && !learningPathIds.has(collection.id)) return [];
    return [{ ...collection, learningPathId: learningPathIds.get(collection.id) ?? null }];
  });
  const selected = courses.filter((collection) => collection.subscribed).sort(byTitle);
  if (selected.length) return selected;

  const initialCourse = courses.find((collection) => collection.slug === INITIAL_COURSE_SLUG);
  return initialCourse ? [initialCourse] : [];
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
      const learningPathIds = new Map(
        (learningPathCollections.learningPaths ?? []).map((item) => [item.collectionId, item.pathId]),
      );
      this.courses.set(courseMenuCollections(
        collections,
        learningPathIds,
        new Set(learningPathCollections.collectionIds ?? []),
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
