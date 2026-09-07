import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';
import { SelectedCoursesFacade, selectedCourseCollections } from './selected-courses.facade';

function collection(overrides: Partial<LibraryCollection> = {}): LibraryCollection {
  return {
    id: 'bbc-six-minute-english',
    slug: 'bbc-six-minute-english',
    title: 'BBC 6 Minute English',
    kind: 'course',
    visibility: 'public',
    status: 'published',
    contentVersion: 1,
    wordCount: 0,
    subscribed: true,
    ...overrides,
  };
}

describe('SelectedCoursesFacade', () => {
  const list = vi.fn();
  let facade: SelectedCoursesFacade;

  beforeEach(() => {
    list.mockReset();
    list.mockResolvedValue({ collections: [collection()] });
    TestBed.configureTestingModule({ providers: [
      SelectedCoursesFacade,
      { provide: LibraryApiService, useValue: { list } },
    ] });
    facade = TestBed.inject(SelectedCoursesFacade);
  });

  it('keeps only previously selected course collections', () => {
    const result = selectedCourseCollections([
      collection(),
      collection({ id: 'unselected-course', slug: 'unselected-course', title: 'Unselected course', subscribed: false }),
      collection({ id: 'vocabulary', slug: 'vocabulary', title: 'Vocabulary', kind: 'collection', subscribed: true }),
    ]);

    expect(result.map((course) => course.id)).toEqual(['bbc-six-minute-english']);
  });

  it('loads selected courses from the existing library subscription contract', async () => {
    expect(await facade.load()).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);
    expect(facade.courses().map((course) => course.title)).toEqual(['BBC 6 Minute English']);
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBe('');
  });

  it('preserves the last valid course list when a refresh fails', async () => {
    await facade.load();
    list.mockRejectedValueOnce(new Error('offline'));

    expect(await facade.load()).toBe(false);
    expect(facade.courses().map((course) => course.id)).toEqual(['bbc-six-minute-english']);
    expect(facade.error()).toBe('offline');
    expect(facade.loading()).toBe(false);
  });
});
