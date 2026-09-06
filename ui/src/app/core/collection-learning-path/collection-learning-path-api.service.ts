import { Injectable, inject } from '@angular/core';
import type {
  CollectionLearningPathView,
  ExerciseContextView,
  LearningPathResumeView,
} from '../../domain/collection-learning-path/learning-path';
import { ApiClientService } from '../http/api-client.service';

function segment(value: string): string {
  return encodeURIComponent(value);
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
    return this.api.get<{ context: ExerciseContextView }>(
      `/api/learning-paths/${segment(pathId)}/lessons/${segment(lessonId)}/exercises/${segment(exerciseId)}`,
    ).then((response) => response.context);
  }

  commandStartPath(pathId: string): Promise<LearningPathResumeView> {
    return this.api.post<LearningPathResumeView>(`/api/learning-paths/${segment(pathId)}/start`);
  }

  commandStartExercise(pathId: string, lessonId: string, exerciseId: string): Promise<unknown> {
    return this.api.post(
      `/api/learning-paths/${segment(pathId)}/lessons/${segment(lessonId)}/exercises/${segment(exerciseId)}/start`,
    );
  }
}
