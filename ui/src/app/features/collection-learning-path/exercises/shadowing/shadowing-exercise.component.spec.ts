import { describe, expect, it } from 'vitest';
import { ShadowingExerciseComponent } from './shadowing-exercise.component';
import type { ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

describe('ShadowingExerciseComponent', () => {
  const context: ExerciseContext = {
    pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'shadowing-1',
    type: 'speaking.shadowing', schemaVersion: 1, config: {}, payload: null,
  };

  it('emits server-verifiable session evidence after embedded Shadowing completes', () => {
    const component = new ShadowingExerciseComponent();
    const outcomes: ExerciseOutcome[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));
    component.load(context);
    component.complete(' session-1 ');
    expect(outcomes).toEqual([{ kind: 'completed', evidence: { sessionId: 'session-1' } }]);
  });

  it('does not emit completion before runtime context exists', () => {
    const component = new ShadowingExerciseComponent();
    const outcomes: ExerciseOutcome[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));
    component.complete('session-1');
    expect(outcomes).toEqual([]);
  });

  it('maps embedded exit to a cancelled exercise outcome', () => {
    const component = new ShadowingExerciseComponent();
    const outcomes: ExerciseOutcome[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));
    component.load(context);
    component.cancel();
    expect(outcomes).toEqual([{ kind: 'cancelled' }]);
  });
});
