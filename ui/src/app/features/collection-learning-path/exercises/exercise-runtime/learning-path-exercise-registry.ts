import { ScopedVocabularyPracticeExerciseComponent } from '../scoped-vocabulary-practice/scoped-vocabulary-practice-exercise.component';
import { VocabularyIntakeExerciseComponent } from '../vocabulary-intake/vocabulary-intake-exercise.component';
import { VocabularyMasteryCheckExerciseComponent } from '../vocabulary-mastery-check/vocabulary-mastery-check-exercise.component';
import { ExerciseRegistry } from './exercise-registry';

export function createLearningPathExerciseRegistry(): ExerciseRegistry {
  const registry = new ExerciseRegistry();
  registry.register({ type: 'vocabulary.intake', component: VocabularyIntakeExerciseComponent });
  registry.register({ type: 'vocabulary.quick-review', component: ScopedVocabularyPracticeExerciseComponent });
  registry.register({ type: 'vocabulary.mastery-check', component: VocabularyMasteryCheckExerciseComponent });
  return registry;
}
