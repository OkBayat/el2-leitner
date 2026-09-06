import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import type { CollectionLearningPathView, LearningPathResumeView } from '../../domain/collection-learning-path/learning-path';
import { CollectionLearningPathFacade } from './collection-learning-path.facade';

const view: CollectionLearningPathView = {
  path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', status: 'published', contentVersion: 'v1', learnerStatus: 'available', progress: null },
  lessons: [],
};
const resume: LearningPathResumeView = { pathId: 'path-1', pathStatus: 'available', resumePoint: { lessonId: 'lesson-1', exerciseId: 'exercise-1' } };

describe('CollectionLearningPathFacade', () => {
  const queryCollectionLearningPath = vi.fn();
  const queryResumePoint = vi.fn();
  const commandStartPath = vi.fn();
  let facade: CollectionLearningPathFacade;

  beforeEach(() => {
    for (const fn of [queryCollectionLearningPath, queryResumePoint, commandStartPath]) fn.mockReset();
    queryCollectionLearningPath.mockResolvedValue(structuredClone(view));
    queryResumePoint.mockResolvedValue(structuredClone(resume));
    commandStartPath.mockResolvedValue({ ...resume, pathStatus: 'in_progress' });
    TestBed.configureTestingModule({ providers: [CollectionLearningPathFacade, { provide: CollectionLearningPathApiService, useValue: { queryCollectionLearningPath, queryResumePoint, commandStartPath } }] });
    facade = TestBed.inject(CollectionLearningPathFacade);
  });

  it('loads the path read model and server-derived resume point together', async () => {
    expect(await facade.load('collection-1')).toBe(true);
    expect(facade.view()?.path.id).toBe('path-1');
    expect(facade.resume()?.resumePoint?.exerciseId).toBe('exercise-1');
    expect(queryCollectionLearningPath).toHaveBeenCalledWith('collection-1');
    expect(queryResumePoint).toHaveBeenCalledWith('path-1');
  });

  it('starts through the command boundary and refreshes the query projection', async () => {
    await facade.load('collection-1');
    queryCollectionLearningPath.mockResolvedValueOnce({ ...structuredClone(view), path: { ...view.path, learnerStatus: 'in_progress' } });
    expect(await facade.start()).toBe(true);
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
