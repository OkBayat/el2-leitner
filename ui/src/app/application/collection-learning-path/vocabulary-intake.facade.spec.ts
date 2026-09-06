import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { VocabularyIntakeFacade } from './vocabulary-intake.facade';

describe('VocabularyIntakeFacade', () => {
  it('keeps scoped activation behind the Learning Path command API', async () => {
    const commandActivateVocabularyIntake = vi.fn().mockResolvedValue({ activatedCount: 1 });
    TestBed.configureTestingModule({
      providers: [
        VocabularyIntakeFacade,
        { provide: CollectionLearningPathApiService, useValue: { commandActivateVocabularyIntake } },
      ],
    });
    const facade = TestBed.inject(VocabularyIntakeFacade);

    await facade.activate('path-1', 'lesson-1', 'exercise-1');

    expect(commandActivateVocabularyIntake).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1');
  });
});
