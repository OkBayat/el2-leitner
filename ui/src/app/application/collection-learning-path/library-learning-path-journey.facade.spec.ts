import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { CollectionLearningPathView } from '../../domain/collection-learning-path/learning-path';
import type { LibraryCollection } from '../../domain/learning/models';
import { LibraryLearningPathJourneyFacade } from './library-learning-path-journey.facade';

function collection(overrides: Partial<LibraryCollection> = {}): LibraryCollection {
  return {
    id: 'cambridge-vocabulary-for-ielts',
    slug: 'cambridge-vocabulary-for-ielts',
    title: 'Cambridge Vocabulary for IELTS',
    kind: 'book',
    visibility: 'public',
    status: 'published',
    contentVersion: 1,
    wordCount: 100,
    subscribed: false,
    ...overrides,
  };
}

function pathView(collectionId: string): CollectionLearningPathView {
  return {
    access: { canProgress: false },
    resumePoint: null,
    path: {
      id: 'cvfi-learning-path',
      collectionId,
      title: 'Cambridge Vocabulary for IELTS',
      mode: 'finite',
      status: 'published',
      contentVersion: '1',
      learnerStatus: 'available',
      progress: null,
    },
    lessons: [],
  };
}

describe('LibraryLearningPathJourneyFacade', () => {
  const queryCollectionLearningPath = vi.fn();
  let facade: LibraryLearningPathJourneyFacade;

  beforeEach(() => {
    queryCollectionLearningPath.mockReset();
    TestBed.configureTestingModule({ providers: [
      LibraryLearningPathJourneyFacade,
      { provide: CollectionLearningPathApiService, useValue: { queryCollectionLearningPath } },
      { provide: LibraryApiService, useValue: { subscribe: vi.fn() } },
    ] });
    facade = TestBed.inject(LibraryLearningPathJourneyFacade);
  });

  it('discovers Learning Paths by collection identity instead of collection kind', async () => {
    const cambridge = collection();
    const unrelatedBook = collection({ id: 'other-book', slug: 'other-book', title: 'Other book' });
    queryCollectionLearningPath.mockImplementation(async (collectionId: string) => {
      if (collectionId === cambridge.id) return pathView(collectionId);
      throw new Error('Learning Path not found');
    });

    expect(await facade.load([cambridge, unrelatedBook])).toBe(false);

    expect(queryCollectionLearningPath).toHaveBeenCalledWith(cambridge.id);
    expect(queryCollectionLearningPath).toHaveBeenCalledWith(unrelatedBook.id);
    expect(facade.viewFor(cambridge.id)?.path.id).toBe('cvfi-learning-path');
    expect(facade.viewFor(unrelatedBook.id)).toBeNull();
    expect(facade.error()).toContain('Some courses could not load');
  });

  it('retries a missing course view when the learner opens its card', async () => {
    const cambridge = collection();
    const completed = pathView(cambridge.id);
    completed.access.canProgress = true;
    completed.path.learnerStatus = 'completed';
    queryCollectionLearningPath
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce(completed);

    expect(await facade.load([cambridge])).toBe(false);
    expect(await facade.enter(cambridge)).toEqual({
      kind: 'path', pathId: 'cvfi-learning-path', collectionId: cambridge.id,
    });
    expect(queryCollectionLearningPath).toHaveBeenCalledTimes(2);
    expect(facade.viewFor(cambridge.id)).toBe(completed);
    expect(facade.error()).toBe('');
  });
});
