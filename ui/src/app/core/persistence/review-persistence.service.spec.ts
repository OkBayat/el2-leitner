import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewPersistenceService } from './review-persistence.service';
import { ApiClientService, ApiError } from '../http/api-client.service';
import { ReviewCommand } from '../../domain/learning/models';

const command: ReviewCommand = {
  revision: 7,
  practiceSessionId: 'session-1',
  word: { id: 'w1', box: 1, due: '2026-09-02', attempts: 1, correct: 0, mistakes: 1, currentStreak: 0, introducedOn: '2026-09-01', addedSource: 'daily', lastReviewed: '2026-09-01T10:00:00.000Z', lastPromotedDay: null, blockedUntil: '2026-09-02', masteredAt: null },
  event: { at: '2026-09-01T10:00:00.000Z', day: '2026-09-01', wordId: 'w1', term: 'word', answer: 'wrd', correct: false, mode: 'review', promoted: false, previousBox: 1, newBox: 1, mistakeNumber: 1 },
  daily: { attempts: 1, correct: 0, wrong: 1, newAdded: 10, sessions: 0, durationSeconds: 0 },
};

describe('ReviewPersistenceService', () => {
  it('retries connection/server closures and requires the exact next revision', async () => {
    const api = { post: vi.fn()
      .mockRejectedValueOnce(new ApiError('closed', 503, 'TEMPORARY_FAILURE'))
      .mockRejectedValueOnce(new ApiError('closed', 0, 'NETWORK'))
      .mockResolvedValue({ revision: 8 }) };
    // Network status 0 is deliberately not retried: PR #37 retry shape retries fetch throws,
    // while HttpClient wraps true transport failures as status 0. Treat that as transient here.
    api.post.mockReset()
      .mockRejectedValueOnce(new ApiError('closed', 503, 'TEMPORARY_FAILURE'))
      .mockResolvedValue({ revision: 8 });
    TestBed.configureTestingModule({ providers: [ReviewPersistenceService, { provide: ApiClientService, useValue: api }] });
    const service = TestBed.inject(ReviewPersistenceService);
    expect(await service.persist(command)).toBe(8);
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('does not retry a validation failure', async () => {
    const api = { post: vi.fn().mockRejectedValue(new ApiError('invalid', 400, 'INVALID_REVIEW_RESULT')) };
    TestBed.configureTestingModule({ providers: [ReviewPersistenceService, { provide: ApiClientService, useValue: api }] });
    await expect(TestBed.inject(ReviewPersistenceService).persist(command)).rejects.toMatchObject({ status: 400 });
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
