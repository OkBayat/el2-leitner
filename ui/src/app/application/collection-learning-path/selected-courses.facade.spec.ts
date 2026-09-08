import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { LibraryCollection } from '../../domain/learning/models';
import { SelectedCoursesFacade, courseMenuCollections } from './selected-courses.facade';

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
  const queryLearningPathCollectionIds = vi.fn();
  let facade: SelectedCoursesFacade;

  beforeEach(() => {
    list.mockReset();
    queryLearningPathCollectionIds.mockReset();
    list.mockResolvedValue({ collections: [collection()] });
    queryLearningPathCollectionIds.mockResolvedValue({
      collectionIds: ['bbc-six-minute-english'],
      learningPaths: [{ collectionId: 'bbc-six-minute-english', pathId: '1' }],
    });
    TestBed.configureTestingModule({ providers: [
      SelectedCoursesFacade,
      { provide: LibraryApiService, useValue: { list } },
      { provide: CollectionLearningPathApiService, useValue: { queryLearningPathCollectionIds } },
    ] });
    facade = TestBed.inject(SelectedCoursesFacade);
  });

  it('keeps subscribed Learning Path collections regardless of library kind', () => {
    const cambridge = collection({
      id: 'cambridge-vocabulary-for-ielts',
      slug: 'cambridge-vocabulary-for-ielts',
      title: 'Cambridge Vocabulary for IELTS',
      kind: 'book',
      subscribed: true,
    });
    const unrelated = collection({ id: 'vocabulary', slug: 'vocabulary', title: 'Vocabulary', kind: 'book', subscribed: true });
    const result = courseMenuCollections(
      [collection({ subscribed: false }), cambridge, unrelated],
      new Map([['bbc-six-minute-english', '1'], [cambridge.id, '2']]),
    );

    expect(result.map((course) => course.id)).toEqual([cambridge.id]);
  });

  it('shows BBC 6 Minute English as the initial course while no Learning Path is selected', () => {
    const result = courseMenuCollections(
      [
        collection({ subscribed: false }),
        collection({ id: 'vocabulary', slug: 'vocabulary', title: 'Vocabulary', kind: 'book', subscribed: true }),
      ],
      new Map([['bbc-six-minute-english', '1']]),
    );

    expect(result.map((course) => course.title)).toEqual(['BBC 6 Minute English']);
  });

  it('loads My Courses from one Learning Path discovery request instead of probing every collection', async () => {
    const cambridge = collection({
      id: 'cambridge-vocabulary-for-ielts',
      slug: 'cambridge-vocabulary-for-ielts',
      title: 'Cambridge Vocabulary for IELTS',
      kind: 'book',
      subscribed: true,
    });
    const unrelated = collection({ id: 'other-book', slug: 'other-book', title: 'Other book', kind: 'book', subscribed: true });
    list.mockResolvedValue({ collections: [collection({ subscribed: false }), cambridge, unrelated] });
    queryLearningPathCollectionIds.mockResolvedValue({
      collectionIds: ['bbc-six-minute-english', cambridge.id],
      learningPaths: [
        { collectionId: 'bbc-six-minute-english', pathId: '1' },
        { collectionId: cambridge.id, pathId: '2' },
      ],
    });

    expect(await facade.load()).toBe(true);
    expect(queryLearningPathCollectionIds).toHaveBeenCalledTimes(1);
    expect(facade.courses().map((course) => course.title)).toEqual(['Cambridge Vocabulary for IELTS']);
    expect(facade.courses()[0]?.learningPathId).toBe('2');
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

  it('keeps course navigation available while an older backend returns only collection ids', async () => {
    queryLearningPathCollectionIds.mockResolvedValue({ collectionIds: ['bbc-six-minute-english'] });

    expect(await facade.load()).toBe(true);
    expect(facade.courses().map((course) => ({ id: course.id, pathId: course.learningPathId })))
      .toEqual([{ id: 'bbc-six-minute-english', pathId: null }]);
  });
});
