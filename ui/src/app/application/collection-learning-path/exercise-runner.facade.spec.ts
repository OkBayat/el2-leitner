import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import type { ExerciseContextView } from '../../domain/collection-learning-path/learning-path';
import { ExerciseRunnerFacade } from './exercise-runner.facade';

function context(state: ExerciseContextView['state']): ExerciseContextView {
  return {
    path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', contentVersion: 'v1' },
    lesson: { id: 'lesson-1', title: 'Lesson 1', position: 1 },
    exercise: {
      id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true,
      completionPolicy: 'vocabulary-intake', config: { scope: { kind: 'listening-episode', ref: 'episode-1' } },
    },
    progress: null, state, payload: null,
  };
}

function quickReviewContext(state: ExerciseContextView['state']): ExerciseContextView {
  const value = context(state);
  return {
    ...value,
    exercise: {
      ...value.exercise,
      type: 'vocabulary.quick-review',
      completionPolicy: 'vocabulary-quick-review',
    },
    payload: {
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items: [{ id: 'word-1', term: 'at ease' }],
      summary: { eligibleCount: 1, box: 1 },
    },
  } as ExerciseContextView;
}

describe('ExerciseRunnerFacade', () => {
  const queryExerciseContext = vi.fn();
  const commandStartExercise = vi.fn();
  const commandCompleteExercise = vi.fn();
  const refreshAfterSubscriptionChange = vi.fn();
  let facade: ExerciseRunnerFacade;

  beforeEach(() => {
    queryExerciseContext.mockReset();
    commandStartExercise.mockReset();
    commandCompleteExercise.mockReset();
    refreshAfterSubscriptionChange.mockReset();
    commandStartExercise.mockResolvedValue({ exerciseStatus: 'in_progress' });
    commandCompleteExercise.mockResolvedValue({ exerciseStatus: 'completed' });
    refreshAfterSubscriptionChange.mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [
        ExerciseRunnerFacade,
        { provide: CollectionLearningPathApiService, useValue: { queryExerciseContext, commandStartExercise, commandCompleteExercise } },
        { provide: LearningStoreService, useValue: { refreshAfterSubscriptionChange } },
      ],
    });
    facade = TestBed.inject(ExerciseRunnerFacade);
  });

  it('starts an available exercise through the command boundary then reloads authoritative context', async () => {
    queryExerciseContext.mockResolvedValueOnce(context('available')).mockResolvedValueOnce(context('in_progress'));
    expect(await facade.load('path-1', 'lesson-1', 'exercise-1')).toBe(true);
    expect(commandStartExercise).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1');
    expect(queryExerciseContext).toHaveBeenCalledTimes(2);
    expect(facade.context()?.state).toBe('in_progress');
  });

  it('reconciles canonical global Leitner state before exposing scoped quick review', async () => {
    queryExerciseContext.mockResolvedValueOnce(quickReviewContext('in_progress'));

    expect(await facade.load('path-1', 'lesson-1', 'quick-review-1')).toBe(true);

    expect(refreshAfterSubscriptionChange).toHaveBeenCalledTimes(1);
    expect(facade.context()?.exercise.type).toBe('vocabulary.quick-review');
  });

  it('does not mutate locked or already-completed exercises', async () => {
    queryExerciseContext.mockResolvedValueOnce(context('locked'));
    await facade.load('path-1', 'lesson-1', 'exercise-1');
    expect(commandStartExercise).not.toHaveBeenCalled();
    expect(facade.context()?.state).toBe('locked');
  });

  it('submits a normalized completed outcome and reloads server-authoritative completion', async () => {
    queryExerciseContext.mockResolvedValueOnce(context('in_progress'));
    await facade.load('path-1', 'lesson-1', 'exercise-1');
    queryExerciseContext.mockResolvedValueOnce(context('completed'));

    expect(await facade.complete({ kind: 'completed' })).toBe(true);

    expect(commandCompleteExercise).toHaveBeenCalledWith(
      'path-1', 'lesson-1', 'exercise-1', { kind: 'completed' },
    );
    expect(facade.context()?.state).toBe('completed');
  });

  it('surfaces a recoverable error without inventing progress', async () => {
    queryExerciseContext.mockRejectedValueOnce(new Error('network unavailable'));
    expect(await facade.load('path-1', 'lesson-1', 'exercise-1')).toBe(false);
    expect(facade.context()).toBeNull();
    expect(facade.error()).toBe('network unavailable');
    expect(facade.loading()).toBe(false);
  });
});
