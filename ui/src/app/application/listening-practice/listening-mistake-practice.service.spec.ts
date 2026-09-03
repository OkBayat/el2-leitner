import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState } from '../../domain/learning/learning-rules';
import { ListeningMistakePracticeService } from './listening-mistake-practice.service';

describe('ListeningMistakePracticeService', () => {
  it('persists the House 1 capture and reloads canonical server vocabulary', async () => {
    const initial = createFreshState([{ id: 'weather', term: 'weather' }], new Date('2026-09-03T08:00:00Z'));
    const canonical = createFreshState([
      { id: 'weather', term: 'weather' },
      {
        id: 'db-typhoons',
        term: 'typhoons',
        accepted: ['typhoons'],
        category: 'Listening mistakes',
        box: 1,
        due: '2026-09-03',
        introducedOn: '2026-09-03',
        addedSource: 'listening-mistake',
      },
    ], new Date('2026-09-03T08:00:00Z'));
    const store = {
      initialize: vi.fn().mockResolvedValue(initial),
      replaceAndPersist: vi.fn().mockResolvedValue(undefined),
      refreshCanonical: vi.fn().mockResolvedValue(canonical),
    };
    TestBed.configureTestingModule({
      providers: [
        ListeningMistakePracticeService,
        { provide: LearningStoreService, useValue: store },
      ],
    });

    const service = TestBed.inject(ListeningMistakePracticeService);
    const word = await service.addToHouseOne('typhoons');

    expect(store.replaceAndPersist).toHaveBeenCalledTimes(1);
    const persisted = store.replaceAndPersist.mock.calls[0][0];
    expect(persisted.words.find((item: any) => item.term === 'typhoons')?.box).toBe(1);
    expect(store.refreshCanonical).toHaveBeenCalledTimes(1);
    expect(word.id).toBe('db-typhoons');
    expect(word.box).toBe(1);
  });

  it('fails rather than pretending success when canonical persistence does not contain the word in House 1', async () => {
    const initial = createFreshState([], new Date('2026-09-03T08:00:00Z'));
    const store = {
      initialize: vi.fn().mockResolvedValue(initial),
      replaceAndPersist: vi.fn().mockResolvedValue(undefined),
      refreshCanonical: vi.fn().mockResolvedValue(initial),
    };
    TestBed.configureTestingModule({
      providers: [
        ListeningMistakePracticeService,
        { provide: LearningStoreService, useValue: store },
      ],
    });

    await expect(TestBed.inject(ListeningMistakePracticeService).addToHouseOne('typhoons'))
      .rejects.toThrow(/could not be added/u);
  });
});
