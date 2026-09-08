import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { CollectionLearningPathView, LearningPathResumeView } from '../../domain/collection-learning-path/learning-path';
import { CollectionLearningPathFacade } from './collection-learning-path.facade';

const view: CollectionLearningPathView = {
  access: { canProgress: true },
  resumePoint: { lessonId: 'lesson-1', exerciseId: 'exercise-1' },
  path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', status: 'published', contentVersion: 'v1', learnerStatus: 'available', progress: null },
  lessons: [],
};
const resume: LearningPathResumeView = { pathId: 'path-1', pathStatus: 'available', resumePoint: { lessonId: 'lesson-1', exerciseId: 'exercise-1' } };

describe('CollectionLearningPathFacade', () => {
  const queryCollectionLearningPath = vi.fn();
  const queryLearningPath = vi.fn();
  const queryResumePoint = vi.fn();
  const commandStartPath = vi.fn();
  const subscribe = vi.fn();
  let facade: CollectionLearningPathFacade;

  beforeEach(() => {
    for (const fn of [queryCollectionLearningPath, queryLearningPath, queryResumePoint, commandStartPath, subscribe]) fn.mockReset();
    queryCollectionLearningPath.mockResolvedValue(structuredClone(view));
    queryLearningPath.mockResolvedValue(structuredClone(view));
    queryResumePoint.mockResolvedValue(structuredClone(resume));
    commandStartPath.mockResolvedValue({ ...resume, pathStatus: 'in_progress' });
    TestBed.configureTestingModule({ providers: [
      CollectionLearningPathFacade,
      { provide: CollectionLearningPathApiService, useValue: { queryCollectionLearningPath, queryLearningPath, queryResumePoint, commandStartPath } },
      { provide: LibraryApiService, useValue: { subscribe } },
    ] });
    facade = TestBed.inject(CollectionLearningPathFacade);
  });

  it('loads a canonical path directly by its public route id', async () => {
    expect(await facade.loadByPathId('1')).toBe(true);
    expect(queryLearningPath).toHaveBeenCalledWith('1');
    expect(queryCollectionLearningPath).not.toHaveBeenCalled();
  });

  it('loads the path read model with its server-derived resume point in one query', async () => {
    expect(await facade.load('collection-1')).toBe(true);
    expect(facade.view()?.path.id).toBe('path-1');
    expect(facade.resume()?.resumePoint?.exerciseId).toBe('exercise-1');
    expect(queryCollectionLearningPath).toHaveBeenCalledWith('collection-1');
    expect(queryResumePoint).not.toHaveBeenCalled();
  });

  it('starts through the command boundary and refreshes the query projection', async () => {
    await facade.load('collection-1');
    queryCollectionLearningPath.mockResolvedValueOnce({ ...structuredClone(view), path: { ...view.path, learnerStatus: 'in_progress' } });
    expect(await facade.start()).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(commandStartPath).toHaveBeenCalledWith('path-1');
    expect(facade.view()?.path.learnerStatus).toBe('in_progress');
    expect(facade.resume()?.pathStatus).toBe('in_progress');
  });

  it('preserves the last valid read model when refresh fails and exposes retry state', async () => {
    await facade.load('collection-1');
    queryCollectionLearningPath.mockRejectedValueOnce(new Error('offline'));
    expect(await facade.load('collection-1')).toBe(false);
    expect(facade.view()?.path.id).toBe('path-1');
    expect(facade.error()).toBe('offline');
    expect(facade.loading()).toBe(false);
  });
});
