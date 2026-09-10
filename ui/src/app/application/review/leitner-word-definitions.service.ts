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
		return new Map(requested.map((word) => [word.id, available.get(word.id) ?? '']));
	}
}
