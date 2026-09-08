import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { VocabularyIntakeFacade } from './vocabulary-intake.facade';

describe('VocabularyIntakeFacade', () => {
  it('reconciles canonical vocabulary after scoped server-side activation', async () => {
    const activation = { activatedCount: 1 };
    const commandActivateVocabularyIntake = vi.fn().mockResolvedValue(activation);
    const refreshAfterSubscriptionChange = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        VocabularyIntakeFacade,
        { provide: CollectionLearningPathApiService, useValue: { commandActivateVocabularyIntake } },
        { provide: LearningStoreService, useValue: { refreshAfterSubscriptionChange } },
      ],
    });
    const facade = TestBed.inject(VocabularyIntakeFacade);

    const result = await facade.activate('path-1', 'lesson-1', 'exercise-1');

    expect(commandActivateVocabularyIntake).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1');
    expect(refreshAfterSubscriptionChange).toHaveBeenCalledOnce();
    expect(commandActivateVocabularyIntake.mock.invocationCallOrder[0]).toBeLessThan(
      refreshAfterSubscriptionChange.mock.invocationCallOrder[0],
    );
    expect(result).toBe(activation);
  });
});
