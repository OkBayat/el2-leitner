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
    const vocabulary = { activateBatch: vi.fn().mockResolvedValue(2), activate: vi.fn() };
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
    const vocabulary = { activateBatch: vi.fn(), activate: vi.fn() };
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
});
