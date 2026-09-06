import { Injectable, inject } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import type { VocabularyIntakeActivationView } from '../../domain/collection-learning-path/vocabulary-intake';

@Injectable({ providedIn: 'root' })
export class VocabularyIntakeFacade {
  private readonly api = inject(CollectionLearningPathApiService);

  activate(pathId: string, lessonId: string, exerciseId: string): Promise<VocabularyIntakeActivationView> {
    return this.api.commandActivateVocabularyIntake(pathId, lessonId, exerciseId);
  }
}
