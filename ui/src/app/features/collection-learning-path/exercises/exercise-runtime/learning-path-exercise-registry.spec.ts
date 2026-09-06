import { describe, expect, it } from 'vitest';
import { ScopedVocabularyPracticeExerciseComponent } from '../scoped-vocabulary-practice/scoped-vocabulary-practice-exercise.component';
import { VocabularyIntakeExerciseComponent } from '../vocabulary-intake/vocabulary-intake-exercise.component';
import { createLearningPathExerciseRegistry } from './learning-path-exercise-registry';

describe('Learning Path exercise registry composition', () => {
  it('registers built-in vocabulary exercises without changing the generic registry', () => {
    const registry = createLearningPathExerciseRegistry();
    expect(registry.resolve('vocabulary.intake')).toBe(VocabularyIntakeExerciseComponent);
    expect(registry.resolve('vocabulary.quick-review')).toBe(ScopedVocabularyPracticeExerciseComponent);
    expect(registry.resolve('unknown.exercise')).toBeUndefined();
  });
});
