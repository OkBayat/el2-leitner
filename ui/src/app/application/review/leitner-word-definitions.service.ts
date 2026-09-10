import { Injectable, inject } from '@angular/core';
import { VocabularyApiService } from '../../core/learning/vocabulary-api.service';

export interface LeitnerDefinitionWord {
	readonly id: string;
}

@Injectable({ providedIn: 'root' })
export class LeitnerWordDefinitionsService {
	private readonly vocabularyApi = inject(VocabularyApiService);

	async load(words: readonly LeitnerDefinitionWord[]): Promise<ReadonlyMap<string, string>> {
		const requested = [...new Map(words.map((word) => [word.id, word])).values()];
		const sources = await this.vocabularyApi.sources(requested.map((word) => word.id));
		const available = new Map(sources.map((source) => [
			source.vocabularyId,
			source.definitions?.map((definition) => definition.text.trim()).find(Boolean) ?? '',
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
