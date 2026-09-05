import { Injectable, inject } from '@angular/core';
import { LibraryApiService } from '../../core/library/library-api.service';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ListeningVocabularyResponse } from '../../domain/listening-practice/listening-practice';

@Injectable({ providedIn: 'root' })
export class ListeningVocabularyService {
  private readonly api = inject(ListeningPracticeApiService);
  private readonly library = inject(LibraryApiService);
  private readonly store = inject(LearningStoreService);
  private saving = false;

  load(slug: string): Promise<ListeningVocabularyResponse> { return this.api.getBbcVocabulary(slug); }

  async add(slug: string, vocabularyIds?: readonly string[]): Promise<{ added: number; vocabulary: ListeningVocabularyResponse }> {
    if (this.saving) throw new Error('An episode vocabulary update is already in progress.');
    this.saving = true;
    try {
      await this.store.initialize();
      const vocabulary = await this.load(slug);
      const requested = new Set(vocabularyIds ?? vocabulary.entries.map((entry) => entry.vocabularyId));
      if ([...requested].some((id) => !vocabulary.entries.some((entry) => entry.vocabularyId === id))) {
        throw new Error('Only vocabulary from this episode can be added here.');
      }
      const candidates = vocabulary.entries.filter((entry) => requested.has(entry.vocabularyId) && entry.progress.state === 'new');
      if (!candidates.length) return { added: 0, vocabulary };
      if (!vocabulary.subscribed) await this.library.subscribe(vocabulary.collectionId);
      // Subscribing advances the server revision and makes these exact canonical IDs available.
      const state = await this.store.refreshAfterSubscriptionChange();
      const selected = new Set(candidates.map((entry) => entry.vocabularyId));
      const words = state.words.filter((word) => selected.has(word.id) && word.box === 0 && !word.introducedOn && !word.masteredAt);
      let added = 0;
      for (let offset = 0; offset < words.length; offset += 50) {
        const chunk = words.slice(offset, offset + 50);
        if (vocabularyIds?.length === 1 && chunk.length === 1) {
          await this.store.activateWord(chunk[0]); added += 1;
        } else {
          const result = await this.store.activateWords(chunk, 'home-selection');
          added += result.activated.length;
        }
      }
      return { added, vocabulary: await this.load(slug) };
    } finally { this.saving = false; }
  }
}
