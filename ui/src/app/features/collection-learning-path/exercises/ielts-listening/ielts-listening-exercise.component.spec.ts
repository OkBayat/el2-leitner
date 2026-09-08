import { describe, expect, it } from 'vitest';
import { IeltsListeningExerciseComponent } from './ielts-listening-exercise.component';
import type { ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

function context(overrides: Partial<ExerciseContext> = {}): ExerciseContext {
  return {
    pathId: 'path-1',
    lessonId: 'lesson-1',
    exerciseId: 'exercise-1',
    type: 'listening.ielts',
    schemaVersion: 1,
    state: 'in_progress',
    config: { lessonSlug: 'climate-change', testId: 'test-2' },
    payload: {
      reference: { lessonSlug: 'climate-change', testId: 'test-2' },
      lesson: { id: 'listening-lesson-1', slug: 'climate-change', title: 'Climate change' },
      test: { id: 'test-2', title: 'Test 2', groups: [] },
    },
    ...overrides,
  };
}

describe('IELTS listening Learning Path exercise', () => {
  it('loads hydrated listening data and emits submitted attempt evidence', () => {
    const component = new IeltsListeningExerciseComponent();
    const outcomes: ExerciseOutcome[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));

    component.load(context());
    component.onAttemptSubmitted({ attemptId: 'attempt-1' });

    expect(component.payload()?.reference).toEqual({ lessonSlug: 'climate-change', testId: 'test-2' });
    expect(outcomes).toEqual([{ kind: 'completed', evidence: { attemptId: 'attempt-1' } }]);
  });

  it('does not start another listening attempt when the Learning Path exercise is already complete', () => {
    const component = new IeltsListeningExerciseComponent();
    component.load(context({ state: 'completed' }));

    expect(component.completed()).toBe(true);
    expect(component.payload()).toBeNull();
  });

  it('fails closed when the hydrated payload is malformed', () => {
    const component = new IeltsListeningExerciseComponent();
    component.load(context({ payload: { reference: { lessonSlug: 'x', testId: 'y' } } }));

    expect(component.payload()).toBeNull();
    expect(component.error()).toBe('IELTS listening exercise data is unavailable.');
  });
});
