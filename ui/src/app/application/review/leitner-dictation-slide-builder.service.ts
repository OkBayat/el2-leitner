import { Injectable } from '@angular/core';
import type { DictationSlideData, SlideExerciseSlide } from '../../shared/slide-exercise';

export interface LeitnerDictationWord {
	readonly id: string;
	readonly term: string;
	readonly accepted: readonly string[];
}

function acceptedAnswers(word: LeitnerDictationWord): readonly string[] {
	return [...new Set([word.term, ...word.accepted].map((value) => value.trim()).filter(Boolean))];
}

function shuffled<T>(values: readonly T[]): readonly T[] {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1));
		[result[index], result[target]] = [result[target], result[index]];
	}
	return result;
}

@Injectable({ providedIn: 'root' })
export class LeitnerDictationSlideBuilderService {
	build(
		anchorId: string,
		words: readonly LeitnerDictationWord[],
		definitions: ReadonlyMap<string, string> = new Map(),
		shuffle = true,
	): readonly SlideExerciseSlide[] {
		const ordered = shuffle ? shuffled(words) : words;
		return ordered.map((word) => {
			const id = `${anchorId}-vocabulary-dictation-${word.id}`;
			const definition = definitions.get(word.id)?.trim();
			return {
				id,
				rootSlideId: id,
				itemId: word.id,
				type: 'dictation',
				data: {
					mode: 'phrase',
					instruction: 'Listen and type the word or collocation.',
					speech: { text: word.term, autoplay: true, replay: true },
					answer: word.term,
					...(definition ? { definition } : {}),
					acceptedAnswers: acceptedAnswers(word),
					caseSensitive: false,
					punctuationSensitive: false,
				} satisfies DictationSlideData,
			};
		});
	}
}
