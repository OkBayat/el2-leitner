import { describe, expect, it } from 'vitest';
import { ExerciseRegistry } from './exercise-registry';

class FakeExercise {}

describe('ExerciseRegistry', () => {
  it('resolves a registered exercise renderer', () => {
    const registry = new ExerciseRegistry();

    registry.register({ type: 'vocabulary.intake', component: FakeExercise as never });

    expect(registry.resolve('vocabulary.intake')).toBe(FakeExercise);
  });

  it('returns undefined for unknown exercise types', () => {
    expect(new ExerciseRegistry().resolve('unknown')).toBeUndefined();
  });
});
