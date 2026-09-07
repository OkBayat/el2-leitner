import { Injectable, inject, signal } from '@angular/core';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';

const INITIAL_COURSE_SLUG = 'bbc-six-minute-english';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Courses could not load.';
}

function byTitle(left: LibraryCollection, right: LibraryCollection): number {
  return left.title.localeCompare(right.title);
}

export function courseMenuCollections(collections: readonly LibraryCollection[]): LibraryCollection[] {
  const courses = collections.filter((collection) => collection.kind === 'course');
  const selected = courses.filter((collection) => collection.subscribed).sort(byTitle);
  if (selected.length) return selected;

  const initialCourse = courses.find((collection) => collection.slug === INITIAL_COURSE_SLUG);
  return initialCourse ? [initialCourse] : [];
}

@Injectable({ providedIn: 'root' })
export class SelectedCoursesFacade {
  private readonly library = inject(LibraryApiService);
  private requestVersion = 0;

  readonly courses = signal<LibraryCollection[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(): Promise<boolean> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.library.list();
      if (request !== this.requestVersion) return false;
      this.courses.set(courseMenuCollections(result.collections ?? []));
      return true;
    } catch (error) {
      if (request === this.requestVersion) this.error.set(errorMessage(error));
      return false;
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }
}
