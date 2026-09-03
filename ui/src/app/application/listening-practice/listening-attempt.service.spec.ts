import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import { ListeningAttemptStartResponse } from '../../domain/listening-practice/listening-practice';
import { ListeningAttemptService } from './listening-attempt.service';

const started: ListeningAttemptStartResponse = {
  attempt: {
    id: 'attempt-1',
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

  it('starts a clean server-owned attempt and submits every question in lesson order', async () => {
    api.startBbcAttempt.mockResolvedValue(started);
    api.submitBbcAttempt.mockResolvedValue({
      attempt: { ...started.attempt, status: 'completed', submittedAt: '2026-09-03T08:06:00.000Z' },
      score: { correct: 1, wrong: 0, total: 1, percentage: 100 },
      results: [{
        questionId: 'q1',
        number: 1,
        responseType: 'text',
        correct: true,
        submittedAnswer: 'day',
        correctAnswer: 'day',
      }],
    });
    const service = TestBed.inject(ListeningAttemptService);

    expect(await service.start('lesson-1')).toBe(true);
    expect(await service.submit({ q1: 'day' })).toBe(true);

    expect(api.startBbcAttempt).toHaveBeenCalledWith('lesson-1');
    expect(api.submitBbcAttempt).toHaveBeenCalledWith('attempt-1', [
      { questionId: 'q1', value: 'day' },
    ]);
    expect(service.result()?.score.percentage).toBe(100);
    expect(service.submitting()).toBe(false);
  });

  it('surfaces API errors and does not leave loading flags active', async () => {
    api.startBbcAttempt.mockRejectedValue(new Error('Lesson unavailable'));
    const service = TestBed.inject(ListeningAttemptService);

    expect(await service.start('lesson-1')).toBe(false);
    expect(service.error()).toBe('Lesson unavailable');
    expect(service.loading()).toBe(false);
    expect(service.lesson()).toBeNull();
  });
});
