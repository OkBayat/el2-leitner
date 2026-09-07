import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSessionService } from '../../../../application/review/review-session.service';
import { CollectionLearningPathApiService } from '../../../../core/collection-learning-path/collection-learning-path-api.service';
import type { ExerciseContext } from '../exercise-runtime/exercise-contracts';
import { SlideBaseExerciseSessionService } from './slide-base-exercise-session.service';

const context: ExerciseContext = {
  pathId: 'path-1',
  lessonId: 'lesson-1',
  exerciseId: 'exercise-1',
  type: 'slide-base',
  schemaVersion: 1,
  completionPolicy: 'vocabulary-spelling',
  config: {},
  payload: null,
};

describe('SlideBaseExerciseSessionService', () => {
  const commandStartVocabularySpelling = vi.fn();
  const openLearningPathSpelling = vi.fn();
  const submit = vi.fn();
  const next = vi.fn();
  const abandon = vi.fn();
  const active = vi.fn();
  const currentWord = vi.fn();
  const completedSessionId = vi.fn();
  let service: SlideBaseExerciseSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    commandStartVocabularySpelling.mockResolvedValue({
      session: { id: 'session-1' },
      payload: {
        scope: 'course',
        items: [
          { id: 'word-1', term: 'alpha', accepted: ['alpha'] },
          { id: 'word-2', term: 'beta', accepted: ['beta'] },
        ],
        summary: { box: 1, eligibleCount: 2 },
      },
    });
    openLearningPathSpelling.mockResolvedValue(true);
    currentWord.mockReturnValueOnce({ id: 'word-1' }).mockReturnValueOnce({ id: 'word-2' });
    completedSessionId.mockReturnValue('session-1');
    active.mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        SlideBaseExerciseSessionService,
        { provide: CollectionLearningPathApiService, useValue: { commandStartVocabularySpelling } },
        {
          provide: ReviewSessionService,
          useValue: { openLearningPathSpelling, submit, next, abandon, active, currentWord, completedSessionId },
        },
      ],
    });
    service = TestBed.inject(SlideBaseExerciseSessionService);
  });

  it('opens one server-snapshotted spelling session and completes it from slide results', async () => {
    const items = await service.startVocabularySpelling(context, 'course');
    const outcome = await service.complete('vocabulary-spelling', [
      { slideId: 'slide-1', rootSlideId: 'slide-1', slideType: 'dictation', itemId: 'word-1', data: { answer: 'alpha', correct: true } },
      { slideId: 'slide-2', rootSlideId: 'slide-2', slideType: 'dictation', itemId: 'word-2', data: { answer: 'bet', correct: false } },
    ]);

    expect(items.map((item) => item.id)).toEqual(['word-1', 'word-2']);
    expect(commandStartVocabularySpelling).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1', 'course');
    expect(openLearningPathSpelling).toHaveBeenCalledWith(['word-1', 'word-2'], 'session-1');
    expect(submit.mock.calls.map(([answer]) => answer)).toEqual(['alpha', 'bet']);
    expect(next).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ kind: 'completed', evidence: { scope: 'course', sessionId: 'session-1' } });
  });

  it('completes an empty selected scope without creating review events', async () => {
    commandStartVocabularySpelling.mockResolvedValue({
      session: null,
      payload: { scope: 'all', items: [], summary: { box: 1, eligibleCount: 0 } },
    });

    await service.startVocabularySpelling(context, 'all');
    const outcome = await service.complete('vocabulary-spelling', []);

    expect(openLearningPathSpelling).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'completed', evidence: { scope: 'all' } });
  });
});
