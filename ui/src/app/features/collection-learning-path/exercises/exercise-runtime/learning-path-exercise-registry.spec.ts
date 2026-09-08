import { describe, expect, it } from 'vitest';
import { createLearningPathExerciseRegistry } from './learning-path-exercise-registry';

describe('Learning Path exercise registry composition', () => {
  it('registers built-in exercise loaders without eagerly importing renderer chunks', async () => {
    const registry = createLearningPathExerciseRegistry();
    const cases = [
      ['vocabulary.intake', 'VocabularyIntakeExerciseComponent'],
      ['slides.sequence', 'SlidesSequenceExerciseComponent'],
      ['slide-base', 'SlideBaseExerciseComponent'],
      ['vocabulary.quick-review', 'ScopedVocabularyPracticeExerciseComponent'],
      ['vocabulary.mastery-check', 'VocabularyMasteryCheckExerciseComponent'],
      ['listening.ielts', 'IeltsListeningExerciseComponent'],
      ['speaking.shadowing', 'ShadowingExerciseComponent'],
    ] as const;

    for (const [type, componentName] of cases) {
      const loader = registry.resolve(type);
      expect(loader).toBeTypeOf('function');
      const component = await loader?.();
      expect(component).toBeDefined();
      expect(component?.prototype).toBeDefined();
      expect(component?.name.replace(/^_/, '')).toBe(componentName);
    }
    expect(registry.resolve('unknown.exercise')).toBeUndefined();
  });
});
