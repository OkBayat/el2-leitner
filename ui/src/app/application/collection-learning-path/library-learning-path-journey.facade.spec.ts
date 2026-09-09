import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
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
  const queryLearningPathCollectionIds = vi.fn();
  const commandRemovePathEnrollment = vi.fn();
  const commandStartPath = vi.fn();
  let facade: LibraryLearningPathJourneyFacade;

  beforeEach(() => {
    queryCollectionLearningPath.mockReset();
    queryLearningPathCollectionIds.mockReset();
    commandRemovePathEnrollment.mockReset();
    commandStartPath.mockReset();
    TestBed.configureTestingModule({ providers: [
      LibraryLearningPathJourneyFacade,
      {
        provide: CollectionLearningPathApiService,
        useValue: {
          queryCollectionLearningPath,
          queryLearningPathCollectionIds,
          commandRemovePathEnrollment,
          commandStartPath,
        },
      },
    ] });
    facade = TestBed.inject(LibraryLearningPathJourneyFacade);
  });

  it('uses one course catalog projection without loading per-course details', async () => {
    const cambridge = collection();
    const unrelatedBook = collection({ id: 'other-book', slug: 'other-book', title: 'Other book' });
    queryLearningPathCollectionIds.mockResolvedValue({
      collectionIds: [cambridge.id],
      learningPaths: [{
        collectionId: cambridge.id,
        pathId: 'cvfi-learning-path',
        title: 'Cambridge Vocabulary for IELTS',
        learnerStatus: 'available',
        enrolled: false,
      }],
    });

    expect(await facade.loadCatalog([cambridge, unrelatedBook])).toBe(true);

    expect(queryCollectionLearningPath).not.toHaveBeenCalled();
    expect(facade.courseSummaryFor(cambridge.id)?.pathId).toBe('cvfi-learning-path');
    expect(facade.courseSummaryFor(unrelatedBook.id)).toBeNull();
    expect(facade.catalogReady()).toBe(true);
    expect(facade.error()).toBe('');
  });

  it('normalizes the predecessor route-only catalog without classifying unrelated subscriptions as courses', async () => {
    const cambridge = collection({ subscribed: true });
    const secondCourse = collection({
      id: 'second-course', slug: 'second-course', title: 'Second Course', subscribed: false,
    });
    const podcast = collection({
      id: 'podcast-episode', slug: 'podcast-episode', title: 'Podcast Episode', subscribed: true,
    });
    queryLearningPathCollectionIds.mockResolvedValue({
      collectionIds: [cambridge.id, secondCourse.id],
      learningPaths: [
        { collectionId: cambridge.id, pathId: 'path-1' },
        { collectionId: secondCourse.id, pathId: 'path-2' },
      ],
    });

    expect(await facade.loadCatalog([cambridge, secondCourse, podcast])).toBe(true);

    expect(facade.courseSummaryFor(cambridge.id)).toMatchObject({
      title: cambridge.title, enrolled: true, learnerStatus: 'in_progress',
    });
    expect(facade.courseSummaryFor(secondCourse.id)).toMatchObject({
      title: secondCourse.title, enrolled: false, learnerStatus: 'available',
    });
    expect(facade.courseSummaryFor(podcast.id)).toBeNull();
  });

  it('fails closed when course catalog discovery fails', async () => {
    const cambridge = collection();
    queryLearningPathCollectionIds.mockRejectedValue(new Error('offline'));

    expect(await facade.loadCatalog([cambridge])).toBe(false);
    expect(facade.courseSummaryFor(cambridge.id)).toBeNull();
    expect(facade.catalogReady()).toBe(false);
    expect(facade.error()).toContain('Courses could not load');
  });

  it('marks the catalog unavailable during refresh instead of exposing stale readiness', async () => {
    const cambridge = collection();
    queryLearningPathCollectionIds.mockResolvedValueOnce({
      learningPaths: [{
        collectionId: cambridge.id,
        pathId: 'cvfi-learning-path',
        title: cambridge.title,
        learnerStatus: 'available',
        enrolled: false,
      }],
    });
    expect(await facade.loadCatalog([cambridge])).toBe(true);

    let resolveRefresh!: (value: { learningPaths: never[] }) => void;
    queryLearningPathCollectionIds.mockReturnValueOnce(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    const refresh = facade.loadCatalog([cambridge]);

    expect(facade.catalogReady()).toBe(false);
    resolveRefresh({ learningPaths: [] });
    expect(await refresh).toBe(true);
  });

  it('evicts a loaded course view when the refreshed catalog retires that course', async () => {
    const cambridge = collection();
    queryLearningPathCollectionIds
      .mockResolvedValueOnce({ learningPaths: [{
        collectionId: cambridge.id,
        pathId: 'cvfi-learning-path',
        title: cambridge.title,
        learnerStatus: 'available',
        enrolled: false,
      }] })
      .mockResolvedValueOnce({ learningPaths: [] });
    queryCollectionLearningPath.mockResolvedValueOnce(pathView(cambridge.id));

    expect(await facade.loadCatalog([cambridge])).toBe(true);
    expect(await facade.openOverview(cambridge)).not.toBeNull();
    expect(facade.viewFor(cambridge.id)).not.toBeNull();

    expect(await facade.loadCatalog([cambridge])).toBe(true);
    expect(facade.courseSummaryFor(cambridge.id)).toBeNull();
    expect(facade.viewFor(cambridge.id)).toBeNull();
  });

  it('keeps catalog loading to one request for hundreds of courses', async () => {
    const collections = Array.from({length: 250}, (_, index) => collection({
      id: `course-${index}`,
      slug: `course-${index}`,
      title: `Course ${index}`,
    }));
    queryLearningPathCollectionIds.mockResolvedValue({
      collectionIds: collections.map((item) => item.id),
      learningPaths: collections.map((item, index) => ({
        collectionId: item.id,
        pathId: String(index + 1),
        title: item.title,
        learnerStatus: 'available',
        enrolled: false,
      })),
    });

    expect(await facade.loadCatalog(collections)).toBe(true);
    expect(queryLearningPathCollectionIds).toHaveBeenCalledTimes(1);
    expect(queryCollectionLearningPath).not.toHaveBeenCalled();
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

  it('opens a course overview without subscribing or starting learner progress', async () => {
    const cambridge = collection();
    queryCollectionLearningPath.mockResolvedValueOnce(pathView(cambridge.id));

    expect(await facade.openOverview(cambridge)).toEqual({
      kind: 'path', pathId: 'cvfi-learning-path', collectionId: cambridge.id,
    });

    expect(facade.viewFor(cambridge.id)?.path.learnerStatus).toBe('available');
  });

  it('starts an available course without subscribing its vocabulary collection', async () => {
    const cambridge = collection();
    queryCollectionLearningPath.mockResolvedValueOnce(pathView(cambridge.id));
    commandStartPath.mockResolvedValueOnce({
      pathId: 'cvfi-learning-path',
      pathStatus: 'in_progress',
      resumePoint: {lessonId: 'lesson-1', exerciseId: 'exercise-1'},
    });

    expect(await facade.enter(cambridge)).toEqual({
      kind: 'exercise',
      pathId: 'cvfi-learning-path',
      lessonId: 'lesson-1',
      exerciseId: 'exercise-1',
    });
    expect(commandStartPath).toHaveBeenCalledWith('cvfi-learning-path');
  });

  it('removes course enrollment through the dedicated course command', async () => {
    commandRemovePathEnrollment.mockResolvedValue({pathId: 'cvfi-learning-path', removed: true});

    expect(await facade.removeEnrollment('cvfi-learning-path')).toBe(true);

    expect(commandRemovePathEnrollment).toHaveBeenCalledWith('cvfi-learning-path');
  });
});
