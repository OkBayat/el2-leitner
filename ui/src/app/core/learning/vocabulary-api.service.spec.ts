import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VocabularyApiService } from './vocabulary-api.service';
import { ApiClientService } from '../http/api-client.service';

describe('VocabularyApiService compact persistence', () => {
  it('uses the single activation endpoint and exact next revision', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 4 }), put: vi.fn(), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });
    expect(await TestBed.inject(VocabularyApiService).activate(3, 'word-1', '2026-09-01')).toBe(4);
    expect(api.post).toHaveBeenCalledWith('/api/learning/vocabulary-activations', { revision: 3, vocabularyId: 'word-1', day: '2026-09-01' });
  });

  it('uses one batch request for daily activation instead of a full-state write', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 9 }), put: vi.fn(), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });
    expect(await TestBed.inject(VocabularyApiService).activateBatch(8, ['a', 'b'], '2026-09-01', 'daily')).toBe(9);
    expect(api.post).toHaveBeenCalledWith('/api/learning/vocabulary-activation-batches', { revision: 8, vocabularyIds: ['a', 'b'], day: '2026-09-01', source: 'daily' });
  });

  it('uses the dedicated exclusion command for removing an unintroduced word', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 6 }), put: vi.fn(), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });

    expect(await TestBed.inject(VocabularyApiService).exclude(5, 'word-1')).toBe(6);
    expect(api.post).toHaveBeenCalledWith('/api/learning/vocabulary-exclusions', {
      revision: 5,
      vocabularyId: 'word-1',
    });
  });

  it('sends only the edited vocabulary fields and revision for a word edit', async () => {
    const api = {
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn().mockResolvedValue({
        revision: 13,
        word: { id: 'word-1', term: 'circumstances', accepted: ['circumstances'], category: 'Discussion', notes: 'edited' },
      }),
    };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });

    const result = await TestBed.inject(VocabularyApiService).update(12, 'word-1', {
      term: 'circumstances',
      acceptedForms: ['circumstances'],
      category: 'Discussion',
      notes: 'edited',
    });

    expect(result.revision).toBe(13);
    expect(api.put).toHaveBeenCalledWith('/api/learning/vocabulary/word-1', {
      revision: 12,
      term: 'circumstances',
      acceptedForms: ['circumstances'],
      category: 'Discussion',
      notes: 'edited',
    });
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('state');
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('words');
  });

  it('rejects a non-monotonic revision', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 7 }), put: vi.fn(), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });
    await expect(TestBed.inject(VocabularyApiService).activate(7, 'a', '2026-09-01')).rejects.toThrow(/revision/u);
  });
});
