import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import { ListeningAttemptResult, ListeningAttemptStartResponse } from '../../domain/listening-practice/listening-practice';
import { ListeningAttemptService } from './listening-attempt.service';

const started: ListeningAttemptStartResponse = {
  attempt: {
    id: 'attempt-1',
    testId: 'test-2',
    status: 'active',
    startedAt: '2026-09-03T08:00:00.000Z',
    totalQuestions: 1,
  },
  lesson: {
    id: 'lesson-1',
    slug: 'lesson-1',
    title: 'Lesson',
    description: null,
    episodeCode: '1',
    episodeDate: '2026-09-03',
    sourceUrl: 'https://example.com',
    audioUrl: '/api/listening/bbc/lessons/lesson-1/audio',
    questionCount: 3,
    testCount: 3,
  },
  test: {
    id: 'test-2',
    title: 'Test 2',
    position: 2,
    questionCount: 1,
    groups: [{
      id: 'group-1',
      position: 1,
      heading: 'Question 1',
      taskType: 'note_completion',
      instruction: 'Complete the note.',
      answerInstruction: 'Write one word.',
      maxWords: 1,
      maxNumbers: 0,
      questions: [{ id: 'q1', number: 1, position: 1, responseType: 'text', prompt: 'Every {{blank}}.' }],
    }],
  },
};

const completed: ListeningAttemptResult = {
  attempt: {
    ...started.attempt,
    status: 'completed',
    submittedAt: '2026-09-03T08:06:00.000Z',
  },
  score: { correct: 1, wrong: 0, total: 1, percentage: 100 },
  results: [{
    questionId: 'q1',
    number: 1,
    responseType: 'text',
    correct: true,
    submittedAnswer: 'day',
    correctAnswer: 'day',
  }],
};

describe('ListeningAttemptService', () => {
  const api = {
    startBbcAttempt: vi.fn(),
    submitBbcAttempt: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [ListeningAttemptService, { provide: ListeningPracticeApiService, useValue: api }],
    });
  });

  it('starts the selected server-owned test and submits its questions in order', async () => {
    api.startBbcAttempt.mockResolvedValue(started);
    api.submitBbcAttempt.mockResolvedValue(completed);
    const service = TestBed.inject(ListeningAttemptService);

    expect(await service.start('lesson-1', 'test-2')).toBe(true);
    expect(service.test()?.title).toBe('Test 2');
    expect(service.lesson()?.audioUrl).toBe('/api/listening/bbc/lessons/lesson-1/audio');
    expect(await service.submit({ q1: 'day' })).toBe(true);

    expect(api.startBbcAttempt).toHaveBeenCalledWith('lesson-1', 'test-2');
    expect(api.submitBbcAttempt).toHaveBeenCalledWith('attempt-1', [
      { questionId: 'q1', value: 'day' },
    ]);
    expect(service.result()?.score.percentage).toBe(100);
    expect(service.submitting()).toBe(false);
  });

  it('starts a fresh attempt when a completed test is retaken', async () => {
    const restarted = {
      ...started,
      attempt: {
        ...started.attempt,
        id: 'attempt-2',
        startedAt: '2026-09-03T08:10:00.000Z',
      },
    };
    api.startBbcAttempt
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(restarted);
    api.submitBbcAttempt.mockResolvedValue(completed);
    const service = TestBed.inject(ListeningAttemptService);

    await service.start('lesson-1', 'test-2');
    await service.submit({ q1: 'day' });

    const restartPromise = service.restart();
    expect(service.restarting()).toBe(true);
    expect(service.result()?.score.percentage).toBe(100);

    expect(await restartPromise).toBe(true);
    expect(api.startBbcAttempt).toHaveBeenLastCalledWith('lesson-1', 'test-2');
    expect(service.attempt()?.id).toBe('attempt-2');
    expect(service.result()).toBeNull();
    expect(service.error()).toBeNull();
    expect(service.restarting()).toBe(false);
  });

  it('keeps completed answers visible when a retake cannot be started', async () => {
    api.startBbcAttempt
      .mockResolvedValueOnce(started)
      .mockRejectedValueOnce(new Error('Retake unavailable'));
    api.submitBbcAttempt.mockResolvedValue(completed);
    const service = TestBed.inject(ListeningAttemptService);

    await service.start('lesson-1', 'test-2');
    await service.submit({ q1: 'day' });

    expect(await service.restart()).toBe(false);
    expect(service.result()?.score.percentage).toBe(100);
    expect(service.attempt()?.status).toBe('completed');
    expect(service.error()).toBe('Retake unavailable');
    expect(service.restarting()).toBe(false);
  });

  it('surfaces API errors and clears both lesson and test state', async () => {
    api.startBbcAttempt.mockRejectedValue(new Error('Test unavailable'));
    const service = TestBed.inject(ListeningAttemptService);

    expect(await service.start('lesson-1', 'test-2')).toBe(false);
    expect(service.error()).toBe('Test unavailable');
    expect(service.loading()).toBe(false);
    expect(service.lesson()).toBeNull();
    expect(service.test()).toBeNull();
  });
});
