import { IeltsListeningExerciseComponent } from '../ielts-listening/ielts-listening-exercise.component';
import { ScopedVocabularyPracticeExerciseComponent } from '../scoped-vocabulary-practice/scoped-vocabulary-practice-exercise.component';
import { VocabularyIntakeExerciseComponent } from '../vocabulary-intake/vocabulary-intake-exercise.component';
import { ExerciseRegistry } from './exercise-registry';

export function createLearningPathExerciseRegistry(): ExerciseRegistry {
  const registry = new ExerciseRegistry();
  registry.register({ type: 'vocabulary.intake', component: VocabularyIntakeExerciseComponent });
  registry.register({ type: 'vocabulary.quick-review', component: ScopedVocabularyPracticeExerciseComponent });
  registry.register({ type: 'listening.ielts', component: IeltsListeningExerciseComponent });
  return registry;
}
