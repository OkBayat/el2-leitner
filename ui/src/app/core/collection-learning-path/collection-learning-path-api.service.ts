import { Injectable, inject } from '@angular/core';
import type {
  CollectionLearningPathView,
  CompletedLearningPathExerciseOutcome,
  ExerciseContextView,
  LearningPathExerciseCompletionView,
  LearningPathResumeView,
} from '../../domain/collection-learning-path/learning-path';
import type { VocabularyIntakeActivationView } from '../../domain/collection-learning-path/vocabulary-intake';
import { ApiClientService } from '../http/api-client.service';

function segment(value: string): string {
  return encodeURIComponent(value);
}

function exercisePath(pathId: string, lessonId: string, exerciseId: string): string {
  return `/api/learning-paths/${segment(pathId)}/lessons/${segment(lessonId)}/exercises/${segment(exerciseId)}`;
}

@Injectable({ providedIn: 'root' })
export class CollectionLearningPathApiService {
  private readonly api = inject(ApiClientService);

  queryCollectionLearningPath(collectionId: string): Promise<CollectionLearningPathView> {
    return this.api.get<CollectionLearningPathView>(`/api/learning-paths/collections/${segment(collectionId)}`);
  }

  queryResumePoint(pathId: string): Promise<LearningPathResumeView> {
    return this.api.get<LearningPathResumeView>(`/api/learning-paths/${segment(pathId)}/resume`);
  }

  queryExerciseContext(pathId: string, lessonId: string, exerciseId: string): Promise<ExerciseContextView> {
    return this.api.get<{ context: ExerciseContextView }>(exercisePath(pathId, lessonId, exerciseId))
      .then((response) => response.context);
  }

  commandStartPath(pathId: string): Promise<LearningPathResumeView> {
    return this.api.post<LearningPathResumeView>(`/api/learning-paths/${segment(pathId)}/start`);
  }

  commandStartExercise(pathId: string, lessonId: string, exerciseId: string): Promise<unknown> {
    return this.api.post(`${exercisePath(pathId, lessonId, exerciseId)}/start`);
  }

  commandActivateVocabularyIntake(
    pathId: string,
    lessonId: string,
    exerciseId: string,
  ): Promise<VocabularyIntakeActivationView> {
    return this.api.post<VocabularyIntakeActivationView>(
      `${exercisePath(pathId, lessonId, exerciseId)}/vocabulary-intake/activate`,
    );
  }

  commandCompleteExercise(
    pathId: string,
    lessonId: string,
    exerciseId: string,
    outcome: CompletedLearningPathExerciseOutcome,
  ): Promise<LearningPathExerciseCompletionView> {
    return this.api.post<LearningPathExerciseCompletionView>(
      `${exercisePath(pathId, lessonId, exerciseId)}/complete`,
      { outcome },
    );
  }
}
