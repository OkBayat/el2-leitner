import { Injectable, inject } from '@angular/core';
import { SentencePracticeApiService } from '../../core/sentence-practice/sentence-practice-api.service';

export interface LeitnerDefinitionWord {
	readonly id: string;
	readonly box: number;
}

@Injectable({ providedIn: 'root' })
export class LeitnerWordDefinitionsService {
	private readonly sentenceApi = inject(SentencePracticeApiService);

	async load(words: readonly LeitnerDefinitionWord[]): Promise<ReadonlyMap<string, string>> {
		const requested = [...new Map(words.map((word) => [word.id, word])).values()];
		const houses = [...new Set(requested.map((word) => word.box))];
		const decks = await Promise.all(houses.map((house) => this.sentenceApi.getDeck(house)));
		const available = new Map(decks.flatMap((deck) => deck.cards).map((card) => [
			card.id,
			card.definitions?.map((definition) => definition.text.trim()).find(Boolean) ?? '',
		]));
		const definitions = new Map<string, string>();
		for (const word of requested) {
			const definition = available.get(word.id);
			if (definition) definitions.set(word.id, definition);
		}
		const missingCount = requested.length - definitions.size;
		if (missingCount) {
			throw new Error(`Definitions are unavailable for ${missingCount} ${missingCount === 1 ? 'word' : 'words'}.`);
		}
		return definitions;
	}
}
