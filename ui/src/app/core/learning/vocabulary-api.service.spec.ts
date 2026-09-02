import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VocabularyApiService } from './vocabulary-api.service';
import { ApiClientService } from '../http/api-client.service';

describe('VocabularyApiService compact persistence', () => {
  it('uses the single activation endpoint and exact next revision', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 4 }), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });
    expect(await TestBed.inject(VocabularyApiService).activate(3, 'word-1', '2026-09-01')).toBe(4);
    expect(api.post).toHaveBeenCalledWith('/api/learning/vocabulary-activations', { revision: 3, vocabularyId: 'word-1', day: '2026-09-01' });
  });

  it('uses one batch request for daily activation instead of a full-state write', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 9 }), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });
    expect(await TestBed.inject(VocabularyApiService).activateBatch(8, ['a', 'b'], '2026-09-01', 'daily')).toBe(9);
    expect(api.post).toHaveBeenCalledWith('/api/learning/vocabulary-activation-batches', { revision: 8, vocabularyIds: ['a', 'b'], day: '2026-09-01', source: 'daily' });
  });

  it('rejects a non-monotonic revision', async () => {
    const api = { post: vi.fn().mockResolvedValue({ revision: 7 }), get: vi.fn() };
    TestBed.configureTestingModule({ providers: [VocabularyApiService, { provide: ApiClientService, useValue: api }] });
    await expect(TestBed.inject(VocabularyApiService).activate(7, 'a', '2026-09-01')).rejects.toThrow(/revision/u);
  });
});
