import { Injectable, inject } from '@angular/core';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { LearningWord } from '../../domain/learning/models';
import { normalizeAnswer } from '../../domain/learning/learning-rules';
import { captureListeningMistakeInHouseOne } from '../../domain/listening-practice/listening-mistake-practice';

@Injectable({ providedIn: 'root' })
export class ListeningMistakePracticeService {
  private readonly store = inject(LearningStoreService);

  async findExistingHouseOneTerms(terms: readonly string[]): Promise<ReadonlySet<string>> {
    await this.store.initialize();
    const requested = new Set(terms.map((term) => normalizeAnswer(term)).filter(Boolean));
    if (!requested.size) return new Set();

    const houseOneForms = new Set<string>();
    for (const word of this.store.snapshot().words) {
      if (word.box !== 1) continue;
      houseOneForms.add(normalizeAnswer(word.term));
      for (const accepted of word.accepted) houseOneForms.add(normalizeAnswer(accepted));
    }

    return new Set([...requested].filter((term) => houseOneForms.has(term)));
  }

  async addToHouseOne(term: string): Promise<LearningWord> {
    await this.store.initialize();
    const capture = captureListeningMistakeInHouseOne(this.store.snapshot(), term);
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
