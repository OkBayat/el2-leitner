import { Injectable, inject } from '@angular/core';
import type {
  CollectionLearningPathView,
  CompletedLearningPathExerciseOutcome,
  ExerciseContextView,
  LearningPathExerciseStartView,
  LearningPathExerciseCompletionView,
  LearningPathResumeView,
} from '../../domain/collection-learning-path/learning-path';
import type { VocabularyIntakeActivationView } from '../../domain/collection-learning-path/vocabulary-intake';
import type { VocabularyMasteryCheckStartView } from '../../domain/collection-learning-path/vocabulary-mastery-check';
import type { VocabularySpellingScope, VocabularySpellingStartView } from '../../domain/collection-learning-path/vocabulary-spelling-practice';
import { ApiClientService } from '../http/api-client.service';

export interface LearningPathCatalogItem {
  collectionId: string;
  pathId: string;
  title: string;
  learnerStatus: 'available' | 'in_progress' | 'completed' | 'up_to_date';
  enrolled: boolean;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

function exercisePath(pathId: string, lessonId: string, exerciseId: string): string {
  return `/api/learning-paths/${segment(pathId)}/lessons/${segment(lessonId)}/exercises/${segment(exerciseId)}`;
}

@Injectable({ providedIn: 'root' })
export class CollectionLearningPathApiService {
  private readonly api = inject(ApiClientService);

  queryLearningPathCollectionIds(): Promise<{
    collectionIds: string[];
    learningPaths?: LearningPathCatalogItem[];
  }> {
    return this.api.get('/api/learning-paths/collections');
  }

  queryCollectionLearningPath(collectionId: string): Promise<CollectionLearningPathView> {
    return this.api.get<CollectionLearningPathView>(`/api/learning-paths/collections/${segment(collectionId)}`);
  }

  queryLearningPath(pathId: string): Promise<CollectionLearningPathView> {
    return this.api.get<CollectionLearningPathView>(`/api/learning-paths/${segment(pathId)}`);
  }

  resolveLegacyExerciseRoute(
    pathId: string,
    lessonId: string,
    exerciseId: string,
  ): Promise<{ pathId: string; lessonId: string; exerciseId: string }> {
    return this.api.get(
      `/api/learning-paths/legacy/${segment(pathId)}/lessons/${segment(lessonId)}/exercises/${segment(exerciseId)}/route`,
    );
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

  commandRemovePathEnrollment(pathId: string): Promise<{pathId: string; removed: boolean}> {
    return this.api.delete<{pathId: string; removed: boolean}>(
      `/api/learning-paths/${segment(pathId)}/enrollment`,
    );
  }

  commandStartExercise(pathId: string, lessonId: string, exerciseId: string, progressRevision = 0): Promise<LearningPathExerciseStartView> {
    return this.api.post<LearningPathExerciseStartView>(`${exercisePath(pathId, lessonId, exerciseId)}/start`, { progressRevision });
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

  commandStartVocabularyMasteryCheck(
    pathId: string,
    lessonId: string,
    exerciseId: string,
  ): Promise<VocabularyMasteryCheckStartView> {
    return this.api.post<VocabularyMasteryCheckStartView>(
      `${exercisePath(pathId, lessonId, exerciseId)}/vocabulary-mastery-check/start`,
    );
  }

  commandStartVocabularySpelling(
    pathId: string,
    lessonId: string,
    exerciseId: string,
    scope: VocabularySpellingScope,
  ): Promise<VocabularySpellingStartView> {
    return this.api.post<VocabularySpellingStartView>(
      `${exercisePath(pathId, lessonId, exerciseId)}/vocabulary-spelling/start`,
      { scope },
    );
  }

  commandUploadSlideSequenceRecording(
    pathId: string,
    lessonId: string,
    exerciseId: string,
    slideId: string,
    recording: Blob,
  ): Promise<{ artifactId: string }> {
    return this.api.post<{ artifactId: string }>(
      `${exercisePath(pathId, lessonId, exerciseId)}/slides/${segment(slideId)}/recordings`,
      recording,
      { 'Content-Type': recording.type || 'audio/webm' },
    );
  }

  commandCompleteExercise(
    pathId: string,
    lessonId: string,
    exerciseId: string,
    outcome: CompletedLearningPathExerciseOutcome,
    progressRevision = 0,
  ): Promise<LearningPathExerciseCompletionView> {
    return this.api.post<LearningPathExerciseCompletionView>(
      `${exercisePath(pathId, lessonId, exerciseId)}/complete`,
      { outcome, progressRevision },
    );
  }
}
