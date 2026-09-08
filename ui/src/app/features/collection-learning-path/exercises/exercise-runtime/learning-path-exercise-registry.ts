import { ExerciseRegistry } from './exercise-registry';

export function createLearningPathExerciseRegistry(): ExerciseRegistry {
  const registry = new ExerciseRegistry();
  registry.register({
    type: 'vocabulary.intake',
    loadComponent: () => import('../vocabulary-intake/vocabulary-intake-exercise.component')
      .then((module) => module.VocabularyIntakeExerciseComponent),
  });
  registry.register({
    type: 'slide-base',
    loadComponent: () => import('../slide-base/slide-base-exercise.component')
      .then((module) => module.SlideBaseExerciseComponent),
  });
  registry.register({
    type: 'vocabulary.quick-review',
    loadComponent: () => import('../scoped-vocabulary-practice/scoped-vocabulary-practice-exercise.component')
      .then((module) => module.ScopedVocabularyPracticeExerciseComponent),
  });
  registry.register({
    type: 'vocabulary.mastery-check',
    loadComponent: () => import('../vocabulary-mastery-check/vocabulary-mastery-check-exercise.component')
      .then((module) => module.VocabularyMasteryCheckExerciseComponent),
  });
  registry.register({
    type: 'listening.ielts',
    loadComponent: () => import('../ielts-listening/ielts-listening-exercise.component')
      .then((module) => module.IeltsListeningExerciseComponent),
  });
  registry.register({
    type: 'speaking.shadowing',
    loadComponent: () => import('../shadowing/shadowing-exercise.component')
      .then((module) => module.ShadowingExerciseComponent),
  });
  return registry;
}
