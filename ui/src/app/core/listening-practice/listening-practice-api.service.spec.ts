import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientService } from '../http/api-client.service';
import { ListeningPracticeApiService } from './listening-practice-api.service';

describe('ListeningPracticeApiService', () => {
  it('uses the BBC lesson catalog and selected-test attempt endpoints', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ provider: 'bbc_6_minute_english', lessons: [] }),
      post: vi.fn()
        .mockResolvedValueOnce({ attempt: { id: 'attempt-1' }, lesson: { id: 'lesson-1' }, test: { id: 'test-2' } })
        .mockResolvedValueOnce({ score: { correct: 1, wrong: 0, total: 1, percentage: 100 } }),
    };
    TestBed.configureTestingModule({
      providers: [ListeningPracticeApiService, { provide: ApiClientService, useValue: api }],
    });
    const service = TestBed.inject(ListeningPracticeApiService);

    await service.listBbcLessons();
    await service.startBbcAttempt('climate change', 'test/2');
    await service.submitBbcAttempt('attempt/1', [{ questionId: 'q1', value: 'day' }]);

    expect(api.get).toHaveBeenCalledWith('/api/listening/bbc/lessons');
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/api/listening/bbc/lessons/climate%20change/tests/test%2F2/attempts',
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/api/listening/bbc/attempts/attempt%2F1/submit',
      { answers: [{ questionId: 'q1', value: 'day' }] },
    );
  });
});
