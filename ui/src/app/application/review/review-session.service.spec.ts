import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { ReviewPersistenceService } from '../../core/persistence/review-persistence.service';
import { SpeechService } from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ReviewSessionService } from './review-session.service';

interface RetryableReviewSessionState {
  backendSessionId: string | null;
  startedAt: number;
  completionPending: boolean;
  activeSignal: { set(value: boolean): void };
  canAdvanceSignal: { set(value: boolean): void };
}

describe('ReviewSessionService completion retry', () => {
  const completeSession = vi.fn();
  const update = vi.fn();
  let service: ReviewSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    completeSession.mockReset();
    completeSession.mockRejectedValueOnce(new Error('completion unavailable')).mockResolvedValue({});
    update.mockImplementation(async (mutate: (state: { daily: Record<string, unknown>; words: never[] }) => void) => {
      mutate({ daily: {}, words: [] });
    });
    TestBed.configureTestingModule({
      providers: [
        ReviewSessionService,
        { provide: LearningStoreService, useValue: { update } },
        { provide: ReviewPersistenceService, useValue: {} },
        { provide: LearningApiService, useValue: { completeSession } },
        { provide: SpeechService, useValue: { cancel: vi.fn() } },
      ],
    });
    service = TestBed.inject(ReviewSessionService);
    const state = service as unknown as RetryableReviewSessionState;
    state.backendSessionId = 'session-1';
    state.startedAt = Date.now();
    state.completionPending = true;
    state.activeSignal.set(true);
    state.canAdvanceSignal.set(true);
  });

  it('keeps a failed finalization active and completes it on the next attempt', async () => {
    await expect(service.next()).rejects.toThrow('completion unavailable');
    expect(service.active()).toBe(true);
    expect(service.completed()).toBe(false);
    expect(service.canAdvance()).toBe(true);

    await expect(service.next()).resolves.toBeUndefined();

    expect(completeSession).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
    expect(service.active()).toBe(false);
    expect(service.completed()).toBe(true);
    expect(service.completedSessionId()).toBe('session-1');
  });
});
