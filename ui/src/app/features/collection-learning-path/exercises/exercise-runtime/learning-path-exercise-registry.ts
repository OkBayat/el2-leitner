import { VocabularyIntakeExerciseComponent } from '../vocabulary-intake/vocabulary-intake-exercise.component';
import { ExerciseRegistry } from './exercise-registry';

export function createLearningPathExerciseRegistry(): ExerciseRegistry {
  const registry = new ExerciseRegistry();
  registry.register({ type: 'vocabulary.intake', component: VocabularyIntakeExerciseComponent });
  return registry;
}
