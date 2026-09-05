import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryApiService } from '../../core/library/library-api.service';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState } from '../../domain/learning/learning-rules';
import { ListeningVocabularyEntry, ListeningVocabularyResponse } from '../../domain/listening-practice/listening-practice';
import { ListeningVocabularyService } from './listening-vocabulary.service';

function entry(id: string, state: ListeningVocabularyEntry['progress']['state'] = 'new'): ListeningVocabularyEntry {
  return { id: `entry-${id}`, vocabularyId: id, term: id, definitions: ['A definition.'], examples: ['An example.'], progress: { state, box: state === 'learning' ? 3 : 0 } };
}
function setup(entries = [entry('target'), entry('mastered', 'mastered'), entry('learning', 'learning')], subscribed = false) {
  const data: ListeningVocabularyResponse = {
    episode: { id: 'episode-1', slug: 'screen-time', title: 'Screen time', level: 'intermediate' },
    collectionId: 'collection-1', subscribed, entries,
  };
  const state = createFreshState([
    ...entries.map((word) => ({ id: word.vocabularyId, term: word.term, box: word.progress.box, masteredAt: word.progress.state === 'mastered' ? '2026-08-01' : null })),
    { id: 'unrelated', term: 'unrelated' },
  ]);
  const api = { getBbcVocabulary: vi.fn().mockResolvedValue(data) };
  const library = { subscribe: vi.fn().mockResolvedValue({}) };
  const store = {
    initialize: vi.fn().mockResolvedValue(state),
    refreshAfterSubscriptionChange: vi.fn().mockResolvedValue(state),
    activateWord: vi.fn().mockResolvedValue(state),
    activateWords: vi.fn().mockImplementation(async (words) => ({ state, activated: words })),
  };
  TestBed.configureTestingModule({ providers: [ListeningVocabularyService,
    { provide: ListeningPracticeApiService, useValue: api },
    { provide: LibraryApiService, useValue: library },
    { provide: LearningStoreService, useValue: store },
  ] });
  return { service: TestBed.inject(ListeningVocabularyService), api, library, store, data };
}

describe('ListeningVocabularyService', () => {
  beforeEach(() => TestBed.resetTestingModule());
  it('reading vocabulary does not subscribe or activate any words', async () => {
    const f = setup(); await f.service.load('screen-time');
    expect(f.api.getBbcVocabulary).toHaveBeenCalledWith('screen-time');
    expect(f.library.subscribe).not.toHaveBeenCalled(); expect(f.store.initialize).not.toHaveBeenCalled();
  });
  it('adds only new words from the selected episode using the existing batch command', async () => {
    const f = setup(); const result = await f.service.add('screen-time');
    expect(result.added).toBe(1);
    expect(f.library.subscribe).toHaveBeenCalledWith('collection-1');
    expect(f.store.refreshAfterSubscriptionChange).toHaveBeenCalledTimes(1);
    expect(f.store.activateWords.mock.calls[0][0].map((word: { id: string }) => word.id)).toEqual(['target']);
    expect(f.store.activateWords.mock.calls[0][1]).toBe('home-selection');
  });
  it('adds one canonical vocabulary identity and does not re-subscribe existing subscribers', async () => {
    const f = setup([entry('target')], true); await f.service.add('screen-time', ['target']);
    expect(f.library.subscribe).not.toHaveBeenCalled();
    expect(f.store.activateWord.mock.calls[0][0].id).toBe('target');
    expect(f.store.activateWords).not.toHaveBeenCalled();
  });
  it('rejects a word belonging to a different episode before any mutation', async () => {
    const f = setup(); await expect(f.service.add('screen-time', ['unrelated'])).rejects.toThrow('Only vocabulary');
    expect(f.library.subscribe).not.toHaveBeenCalled(); expect(f.store.activateWord).not.toHaveBeenCalled();
  });
  it('never resets mastered, learning or excluded vocabulary', async () => {
    const f = setup([entry('one', 'mastered'), entry('two', 'learning'), entry('three', 'excluded')]);
    expect((await f.service.add('screen-time')).added).toBe(0);
    expect(f.library.subscribe).not.toHaveBeenCalled(); expect(f.store.activateWords).not.toHaveBeenCalled();
  });
  it('rechecks canonical progress after subscribing to handle concurrent activation safely', async () => {
    const f = setup([entry('target')]);
    f.store.refreshAfterSubscriptionChange.mockResolvedValue(createFreshState([{ id: 'target', term: 'target', box: 4, introducedOn: '2026-08-01' }]));
    expect((await f.service.add('screen-time')).added).toBe(0);
    expect(f.store.activateWords).not.toHaveBeenCalled();
  });
  it('uses bounded batches for longer episode collections', async () => {
    const f = setup(Array.from({ length: 101 }, (_, index) => entry(`word-${index}`)));
    expect((await f.service.add('screen-time')).added).toBe(101);
    expect(f.store.activateWords.mock.calls.map((call) => call[0].length)).toEqual([50, 50, 1]);
  });
  it('releases its mutation guard after failures so retry is possible', async () => {
    const f = setup(); f.library.subscribe.mockRejectedValueOnce(new Error('offline'));
    await expect(f.service.add('screen-time')).rejects.toThrow('offline');
    expect((await f.service.add('screen-time')).added).toBe(1);
  });
});
