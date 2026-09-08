import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LibraryApiService } from '../../core/library/library-api.service';
import type { CollectionLearningPathView } from '../../domain/collection-learning-path/learning-path';
import { CollectionLearningPathFacade } from './collection-learning-path.facade';
import { LibraryLearningPathJourneyFacade } from './library-learning-path-journey.facade';

function view(overrides: Partial<CollectionLearningPathView['path']> = {}, canProgress = false): CollectionLearningPathView {
  return {
    access: { canProgress },
    resumePoint: { lessonId: 'episode-1', exerciseId: 'exercise-1' },
    path: {
      id: 'path-1', collectionId: 'course-1', title: 'Course', mode: 'rolling', status: 'published',
      contentVersion: '1', learnerStatus: 'available', progress: null, ...overrides,
    },
    lessons: [],
  };
}

const course = {
  id: 'course-1', slug: 'course-1', title: 'Course', kind: 'course', visibility: 'public', status: 'published',
  contentVersion: 1, wordCount: 0, subscribed: false,
};

describe('Collection Learning Path journey facades', () => {
  it('loads the path and embedded resume state with one CQRS query', async () => {
    const initial = view();
    const api = {
      queryCollectionLearningPath: vi.fn().mockResolvedValue(initial),
      queryResumePoint: vi.fn(),
      commandStartPath: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [
      CollectionLearningPathFacade,
      { provide: CollectionLearningPathApiService, useValue: api },
      { provide: LibraryApiService, useValue: { subscribe: vi.fn() } },
    ] });

    const facade = TestBed.inject(CollectionLearningPathFacade);
    expect(await facade.load('course-1')).toBe(true);
    expect(api.queryCollectionLearningPath).toHaveBeenCalledTimes(1);
    expect(api.queryResumePoint).not.toHaveBeenCalled();
    expect(facade.resume()?.resumePoint).toEqual(initial.resumePoint);
  });

  it('enrolls an accessible course before starting it and keeps StartLearningPath server authoritative', async () => {
    const initial = view({}, false);
    const started = { pathId: 'path-1', pathStatus: 'in_progress', resumePoint: initial.resumePoint };
    const refreshed = view({ learnerStatus: 'in_progress' }, true);
    const api = {
      queryCollectionLearningPath: vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed),
      queryResumePoint: vi.fn(),
      commandStartPath: vi.fn().mockResolvedValue(started),
    };
    const library = { subscribe: vi.fn().mockResolvedValue({ collection: { ...course, subscribed: true } }) };
    TestBed.configureTestingModule({ providers: [
      CollectionLearningPathFacade,
      { provide: CollectionLearningPathApiService, useValue: api },
      { provide: LibraryApiService, useValue: library },
    ] });

    const facade = TestBed.inject(CollectionLearningPathFacade);
    await facade.load('course-1');
    expect(await facade.start()).toBe(true);
    expect(library.subscribe).toHaveBeenCalledWith('course-1');
    expect(api.commandStartPath).toHaveBeenCalledWith('path-1');
    expect(facade.resume()?.pathStatus).toBe('in_progress');
  });

  it('drives a generic library Start course action into the server resume point without BBC-specific branching', async () => {
    const initial = view({}, false);
    const api = {
      queryCollectionLearningPath: vi.fn().mockResolvedValue(initial),
      commandStartPath: vi.fn().mockResolvedValue({ pathId: 'path-1', pathStatus: 'in_progress', resumePoint: initial.resumePoint }),
      queryResumePoint: vi.fn(),
    };
    const library = { subscribe: vi.fn().mockResolvedValue({ collection: { ...course, subscribed: true } }) };
    TestBed.configureTestingModule({ providers: [
      LibraryLearningPathJourneyFacade,
      { provide: CollectionLearningPathApiService, useValue: api },
      { provide: LibraryApiService, useValue: library },
    ] });

    const facade = TestBed.inject(LibraryLearningPathJourneyFacade);
    expect(await facade.load([course])).toBe(true);
    const destination = await facade.enter(course);
    expect(library.subscribe).toHaveBeenCalledWith('course-1');
    expect(destination).toEqual({
      kind: 'exercise', pathId: 'path-1', lessonId: 'episode-1', exerciseId: 'exercise-1',
    });
  });

  it('keeps terminal rolling and finite states viewable without issuing another start command', async () => {
    for (const learnerStatus of ['up_to_date', 'completed'] as const) {
      const terminal = view({ learnerStatus }, true);
      terminal.resumePoint = null;
      const api = {
        queryCollectionLearningPath: vi.fn().mockResolvedValue(terminal),
        commandStartPath: vi.fn(),
        queryResumePoint: vi.fn(),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [
        LibraryLearningPathJourneyFacade,
        { provide: CollectionLearningPathApiService, useValue: api },
        { provide: LibraryApiService, useValue: { subscribe: vi.fn() } },
      ] });
      const facade = TestBed.inject(LibraryLearningPathJourneyFacade);
      await facade.load([course]);
      expect(await facade.enter(course)).toEqual({ kind: 'path', pathId: 'path-1', collectionId: 'course-1' });
      expect(api.commandStartPath).not.toHaveBeenCalled();
    }
  });
});
