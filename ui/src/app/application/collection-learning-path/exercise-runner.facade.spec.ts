import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import type { ExerciseContextView } from '../../domain/collection-learning-path/learning-path';
import { ExerciseRunnerFacade } from './exercise-runner.facade';

function context(state: ExerciseContextView['state']): ExerciseContextView {
  return {
    path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', contentVersion: 'v1' },
    lesson: { id: 'lesson-1', title: 'Lesson 1', position: 1 },
    exercise: { id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {} },
    progress: null, state, payload: null,
  };
}

describe('ExerciseRunnerFacade', () => {
  const queryExerciseContext = vi.fn();
  const commandStartExercise = vi.fn();
  let facade: ExerciseRunnerFacade;

  beforeEach(() => {
    queryExerciseContext.mockReset(); commandStartExercise.mockReset();
    commandStartExercise.mockResolvedValue({ exerciseStatus: 'in_progress' });
    TestBed.configureTestingModule({ providers: [ExerciseRunnerFacade, { provide: CollectionLearningPathApiService, useValue: { queryExerciseContext, commandStartExercise } }] });
    facade = TestBed.inject(ExerciseRunnerFacade);
  });

  it('starts an available exercise through the command boundary then reloads authoritative context', async () => {
    queryExerciseContext.mockResolvedValueOnce(context('available')).mockResolvedValueOnce(context('in_progress'));
    expect(await facade.load('path-1', 'lesson-1', 'exercise-1')).toBe(true);
    expect(commandStartExercise).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1');
    expect(queryExerciseContext).toHaveBeenCalledTimes(2);
    expect(facade.context()?.state).toBe('in_progress');
  });

  it('does not mutate locked or already-completed exercises', async () => {
    queryExerciseContext.mockResolvedValueOnce(context('locked'));
    await facade.load('path-1', 'lesson-1', 'exercise-1');
    expect(commandStartExercise).not.toHaveBeenCalled();
    expect(facade.context()?.state).toBe('locked');
  });

  it('surfaces a recoverable error without inventing progress', async () => {
    queryExerciseContext.mockRejectedValueOnce(new Error('network unavailable'));
    expect(await facade.load('path-1', 'lesson-1', 'exercise-1')).toBe(false);
    expect(facade.context()).toBeNull();
    expect(facade.error()).toBe('network unavailable');
    expect(facade.loading()).toBe(false);
  });
});
