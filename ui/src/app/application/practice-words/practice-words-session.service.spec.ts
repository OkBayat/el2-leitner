import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import type { SlideExerciseResult } from '../../shared/slide-exercise';
import { PracticeWordsSessionService } from './practice-words-session.service';

describe('PracticeWordsSessionService', () => {
  const learningApi = {
    startSession: vi.fn(),
    recordSessionAttempt: vi.fn(),
    completeSession: vi.fn(),
    abandonSession: vi.fn(),
  };
  const state = {
    settings: { voiceRate: 0.85 },
    daily: {},
  };
  const store = {
    initialize: vi.fn(),
    snapshot: vi.fn(() => structuredClone(state)),
    replaceLocal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    learningApi.startSession.mockResolvedValue({ session: { id: 'session-1' } });
    learningApi.recordSessionAttempt.mockResolvedValue({
      daily: {
        day: '2026-09-09', attempts: 1, correct: 1, wrong: 0,
        newAdded: 0, sessions: 0, durationSeconds: 0,
      },
    });
    learningApi.completeSession.mockResolvedValue({});
    learningApi.abandonSession.mockResolvedValue({});
    store.initialize.mockResolvedValue(state);
    TestBed.configureTestingModule({
      providers: [
        PracticeWordsSessionService,
        { provide: LearningApiService, useValue: learningApi },
        { provide: LearningStoreService, useValue: store },
      ],
    });
  });

  it('records generated slide outcomes and completes the practice session', async () => {
    const service = TestBed.inject(PracticeWordsSessionService);
    const results: SlideExerciseResult[] = [
      {
        slideId: 'dictation-1', rootSlideId: 'dictation-1', slideType: 'dictation',
        itemId: 'word-1', eventType: 'answered', data: { correct: true, answer: 'word' },
      },
      {
        slideId: 'cloze-2', rootSlideId: 'cloze-2', slideType: 'cloze',
        itemId: 'word-2', eventType: 'answered', data: { correct: false, answers: { answer: 'wrong' } },
      },
    ];

    await service.start('sentence-completion', 2);
    await service.complete(results);

    expect(learningApi.startSession).toHaveBeenCalledWith('practice-words.sentence-completion', 2);
    expect(learningApi.recordSessionAttempt).toHaveBeenNthCalledWith(1, 'session-1', {
      day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u), correct: true,
    });
    expect(learningApi.recordSessionAttempt).toHaveBeenNthCalledWith(2, 'session-1', {
      day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u), correct: false,
    });
    expect(learningApi.completeSession).toHaveBeenCalledWith('session-1', {
      completedCount: 2,
      correctCount: 1,
      wrongCount: 1,
      durationSeconds: expect.any(Number),
    });
    expect(store.replaceLocal).toHaveBeenCalledTimes(2);
  });

  it('abandons an active session and always clears it locally', async () => {
    const service = TestBed.inject(PracticeWordsSessionService);
    await service.start('vocabulary-dictation', 1);
    learningApi.abandonSession.mockRejectedValueOnce(new Error('offline'));

    await expect(service.abandon()).rejects.toThrow('offline');
    await service.complete([]);

    expect(learningApi.completeSession).not.toHaveBeenCalled();
  });
});
