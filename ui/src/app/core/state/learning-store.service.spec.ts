import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { LearningStoreService } from './learning-store.service';
import { ApiClientService } from '../http/api-client.service';
import { CatalogService } from '../catalog/catalog.service';
import { VocabularyApiService } from '../learning/vocabulary-api.service';
import { createFreshState } from '../../domain/learning/learning-rules';

function setup(api: any, catalog: any, vocabulary: any) {
  TestBed.configureTestingModule({ providers: [
    LearningStoreService,
    { provide: ApiClientService, useValue: api },
    { provide: CatalogService, useValue: catalog },
    { provide: VocabularyApiService, useValue: vocabulary },
  ] });
  return TestBed.inject(LearningStoreService);
}

describe('LearningStoreService regressions', () => {
  it('reloads canonical server vocabulary ids before compact daily activation of a fresh state', async () => {
    localStorage.clear();
    const canonical = createFreshState([
      { id: 'db-alpha', term: 'alpha' },
      { id: 'db-beta', term: 'beta' },
    ]);
    const api = {
      get: vi.fn()
        .mockResolvedValueOnce({ state: null, revision: 0 })
        .mockResolvedValueOnce({ state: canonical, revision: 1 }),
      put: vi.fn().mockResolvedValue({ revision: 1 }),
    };
    const catalog = { loadCoreVocabulary: vi.fn().mockResolvedValue([{ term: 'alpha' }, { term: 'beta' }]) };
    const vocabulary = { activateBatch: vi.fn().mockResolvedValue(2), activate: vi.fn(), update: vi.fn() };
    const store = setup(api, catalog, vocabulary);

    const state = await store.initialize();

    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/state?view=bootstrap');
    expect(vocabulary.activateBatch).toHaveBeenCalledTimes(1);
    expect(vocabulary.activateBatch.mock.calls[0][1]).toEqual(['db-alpha', 'db-beta']);
    expect(state.words.every((word) => word.box === 1)).toBe(true);
    expect(store.revision()).toBe(2);
  });

  it('removes legacy localStorage only after upload and canonical bootstrap both succeed', async () => {
    const legacy = createFreshState([{ id: 'legacy-browser-id', term: 'legacy', box: 1, due: '2099-01-01', introducedOn: '2026-08-01' }]);
    localStorage.setItem('vazheyar-ielts-state-v1', JSON.stringify(legacy));
    const failingApi = { get: vi.fn().mockResolvedValue({ state: null, revision: 0 }), put: vi.fn().mockRejectedValue(new Error('offline')) };
    const catalog = { loadCoreVocabulary: vi.fn() };
    const vocabulary = { activateBatch: vi.fn(), activate: vi.fn(), update: vi.fn() };
    await expect(setup(failingApi, catalog, vocabulary).initialize()).rejects.toThrow('offline');
    expect(localStorage.getItem('vazheyar-ielts-state-v1')).not.toBeNull();

    TestBed.resetTestingModule();
    const canonical = createFreshState([{ id: 'db-legacy-id', term: 'legacy', box: 1, due: '2099-01-01', introducedOn: '2026-08-01' }]);
    const successApi = {
      get: vi.fn()
        .mockResolvedValueOnce({ state: null, revision: 0 })
        .mockResolvedValueOnce({ state: canonical, revision: 1 }),
      put: vi.fn().mockResolvedValue({ revision: 1 }),
    };
    const store = setup(successApi, catalog, vocabulary);
    const state = await store.initialize();
    expect(state.words[0].id).toBe('db-legacy-id');
    expect(localStorage.getItem('vazheyar-ielts-state-v1')).toBeNull();
  });

  it('persists a single word edit through the compact vocabulary command instead of PUT /api/state', async () => {
    localStorage.clear();
    const canonical = createFreshState([{ id: 'db-circumstance', term: 'circumstance' }]);
    Object.assign(canonical.words[0], {
      box: 1,
      due: '2099-01-01',
      introducedOn: '2026-08-01',
      category: 'Discussion',
      notes: '',
    });
    const api = {
      get: vi.fn().mockResolvedValue({ state: canonical, revision: 12 }),
      put: vi.fn(),
    };
    const catalog = { loadCoreVocabulary: vi.fn() };
    const vocabulary = {
      activateBatch: vi.fn(),
      activate: vi.fn(),
      update: vi.fn().mockResolvedValue({
        revision: 13,
        word: {
          id: 'db-circumstance',
          term: 'circumstances',
          accepted: ['circumstances', 'circumstance'],
          category: 'Discussion',
          notes: 'plural preferred',
        },
      }),
    };
    const store = setup(api, catalog, vocabulary);
    await store.initialize();

    const state = await store.update((draft) => {
      const word = draft.words[0];
      word.term = 'circumstances';
      word.accepted = ['circumstances', 'circumstance'];
      word.notes = 'plural preferred';
    });

    expect(vocabulary.update).toHaveBeenCalledWith(12, 'db-circumstance', {
      term: 'circumstances',
      acceptedForms: ['circumstances', 'circumstance'],
      category: 'Discussion',
      notes: 'plural preferred',
    });
    expect(api.put).not.toHaveBeenCalled();
    expect(store.revision()).toBe(13);
    expect(state.words[0].term).toBe('circumstances');
  });

  it('uses the theme endpoint and coalesces duplicate in-flight theme writes', async () => {
    localStorage.clear();
    const canonical = createFreshState([]);
    canonical.settings.theme = 'system';
    let resolveTheme!: (value: { theme: 'light'; revision: number }) => void;
    const themeResponse = new Promise<{ theme: 'light'; revision: number }>((resolve) => {
      resolveTheme = resolve;
    });
    const api = {
      get: vi.fn().mockResolvedValue({ state: canonical, revision: 4 }),
      put: vi.fn().mockImplementation((path: string) => {
        if (path === '/api/settings/theme') return themeResponse;
        throw new Error(`Unexpected PUT ${path}`);
      }),
    };
    const store = setup(api, { loadCoreVocabulary: vi.fn() }, {
      activateBatch: vi.fn(), activate: vi.fn(), update: vi.fn(),
    });
    await store.initialize();

    const first = store.update((draft) => { draft.settings.theme = 'light'; });
    const second = store.update((draft) => { draft.settings.theme = 'light'; });

    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/api/settings/theme', { theme: 'light', revision: 4 });

    resolveTheme({ theme: 'light', revision: 5 });
    const [firstState, secondState] = await Promise.all([first, second]);

    expect(firstState.settings.theme).toBe('light');
    expect(secondState.settings.theme).toBe('light');
    expect(store.state()?.settings.theme).toBe('light');
    expect(store.revision()).toBe(5);
  });

  it('keeps multi-setting changes on the full-state endpoint', async () => {
    localStorage.clear();
    const canonical = createFreshState([]);
    canonical.settings.theme = 'system';
    const api = {
      get: vi.fn().mockResolvedValue({ state: canonical, revision: 4 }),
      put: vi.fn().mockResolvedValue({ revision: 5 }),
    };
    const store = setup(api, { loadCoreVocabulary: vi.fn() }, {
      activateBatch: vi.fn(), activate: vi.fn(), update: vi.fn(),
    });
    await store.initialize();

    await store.update((draft) => {
      draft.settings.theme = 'dark';
      draft.settings.dailyGoal += 5;
    });

    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0][0]).toBe('/api/state');
    expect(api.put.mock.calls[0][1].revision).toBe(4);
    expect(api.put.mock.calls[0][1].state.settings.theme).toBe('dark');
    expect(api.put.mock.calls[0][1].state.settings.dailyGoal).toBe(canonical.settings.dailyGoal + 5);
    expect(store.revision()).toBe(5);
  });

  it('refreshes canonical vocabulary after a full-state write without advancing the revision', async () => {
    localStorage.clear();
    const initial = createFreshState([{
      id: 'browser-inland',
      term: 'inland',
      box: 1,
      due: '2026-09-03',
      introducedOn: '2026-09-03',
    }]);
    const canonical = createFreshState([{
      id: 'db-inland',
      term: 'inland',
      box: 1,
      due: '2026-09-03',
      introducedOn: '2026-09-03',
    }]);
    const api = {
      get: vi.fn()
        .mockResolvedValueOnce({ state: initial, revision: 7 })
        .mockResolvedValueOnce({ state: canonical, revision: 7 }),
      put: vi.fn(),
    };
    const store = setup(api, { loadCoreVocabulary: vi.fn() }, {
      activateBatch: vi.fn(), activate: vi.fn(), update: vi.fn(),
    });

    await store.initialize();
    const refreshed = await store.refreshCanonical();

    expect(api.get).toHaveBeenNthCalledWith(2, '/api/state?view=bootstrap');
    expect(refreshed.words[0].id).toBe('db-inland');
    expect(store.state()?.words[0].id).toBe('db-inland');
    expect(store.revision()).toBe(7);
  });
});
describe('Explicit subscription reconciliation', () => {
  it('accepts a newer canonical subscription revision without relaxing normal save checks', async () => {
    TestBed.resetTestingModule();
    const before = createFreshState([{ id: 'old', term: 'old', box: 3 }]);
    const after = createFreshState([{ id: 'old', term: 'old', box: 3 }, { id: 'episode', term: 'episode' }]);
    const api = { get: vi.fn().mockResolvedValue({ state: after, revision: 8 }) };
    const store = setup(api, {}, {}); store.replaceLocal(before, 7);
    await store.refreshAfterSubscriptionChange();
    expect(store.revision()).toBe(8); expect(store.snapshot().words).toHaveLength(2);
    expect(store.snapshot().words[0].box).toBe(3);
    api.get.mockResolvedValue({ state: before, revision: 7 });
    await expect(store.refreshAfterSubscriptionChange()).rejects.toThrow('revision');
    expect(store.snapshot().words).toHaveLength(2);
    api.get.mockResolvedValue({ state: null, revision: 9 });
    await expect(store.refreshAfterSubscriptionChange()).rejects.toThrow('unavailable');
    expect(store.revision()).toBe(8);
  });
});
