import { Injectable, inject } from '@angular/core';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { LearningWord } from '../../domain/learning/models';
import { normalizeAnswer } from '../../domain/learning/learning-rules';
import { captureListeningMistakeInHouseOne } from '../../domain/listening-practice/listening-mistake-practice';

@Injectable({ providedIn: 'root' })
export class ListeningMistakePracticeService {
  private readonly store = inject(LearningStoreService);

  async addToHouseOne(term: string): Promise<LearningWord> {
    const current = await this.store.initialize();
    const capture = captureListeningMistakeInHouseOne(current, term);
    await this.store.replaceAndPersist(capture.state);
    const canonical = await this.store.refreshCanonical();
    const normalized = normalizeAnswer(term);
    const word = canonical.words.find((item) =>
      normalizeAnswer(item.term) === normalized
      || item.accepted.some((accepted) => normalizeAnswer(accepted) === normalized)
    );
    if (!word || word.box !== 1) throw new Error('The listening mistake could not be added to House 1.');
    return word;
  }
}
