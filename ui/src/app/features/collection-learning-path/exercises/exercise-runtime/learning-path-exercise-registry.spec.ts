import { describe, expect, it } from 'vitest';
import { VocabularyIntakeExerciseComponent } from '../vocabulary-intake/vocabulary-intake-exercise.component';
import { createLearningPathExerciseRegistry } from './learning-path-exercise-registry';

describe('Learning Path exercise registry composition', () => {
  it('registers vocabulary intake without changing the generic registry', () => {
    const registry = createLearningPathExerciseRegistry();
    expect(registry.resolve('vocabulary.intake')).toBe(VocabularyIntakeExerciseComponent);
    expect(registry.resolve('unknown.exercise')).toBeUndefined();
  });
});
