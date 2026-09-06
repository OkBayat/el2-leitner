import { describe, expect, it } from 'vitest';
import { IeltsListeningExerciseComponent } from '../ielts-listening/ielts-listening-exercise.component';
import { ScopedVocabularyPracticeExerciseComponent } from '../scoped-vocabulary-practice/scoped-vocabulary-practice-exercise.component';
import { ShadowingExerciseComponent } from '../shadowing/shadowing-exercise.component';
import { VocabularyIntakeExerciseComponent } from '../vocabulary-intake/vocabulary-intake-exercise.component';
import { VocabularyMasteryCheckExerciseComponent } from '../vocabulary-mastery-check/vocabulary-mastery-check-exercise.component';
import { createLearningPathExerciseRegistry } from './learning-path-exercise-registry';

describe('Learning Path exercise registry composition', () => {
  it('registers built-in exercises without changing the generic registry', () => {
    const registry = createLearningPathExerciseRegistry();
    expect(registry.resolve('vocabulary.intake')).toBe(VocabularyIntakeExerciseComponent);
    expect(registry.resolve('vocabulary.quick-review')).toBe(ScopedVocabularyPracticeExerciseComponent);
    expect(registry.resolve('vocabulary.mastery-check')).toBe(VocabularyMasteryCheckExerciseComponent);
    expect(registry.resolve('listening.ielts')).toBe(IeltsListeningExerciseComponent);
    expect(registry.resolve('speaking.shadowing')).toBe(ShadowingExerciseComponent);
    expect(registry.resolve('unknown.exercise')).toBeUndefined();
  });
});
