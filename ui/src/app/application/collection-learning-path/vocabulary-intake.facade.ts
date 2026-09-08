import { Injectable, inject } from '@angular/core';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import type { VocabularyIntakeActivationView } from '../../domain/collection-learning-path/vocabulary-intake';

@Injectable({ providedIn: 'root' })
export class VocabularyIntakeFacade {
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly store = inject(LearningStoreService);

  async activate(pathId: string, lessonId: string, exerciseId: string): Promise<VocabularyIntakeActivationView> {
    const activation = await this.api.commandActivateVocabularyIntake(pathId, lessonId, exerciseId);
    await this.store.refreshAfterSubscriptionChange();
    return activation;
  }
}
