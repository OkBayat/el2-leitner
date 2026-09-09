import { Injectable, inject } from "@angular/core";
import { LearningApiService } from "../../core/learning/learning-api.service";
import { SentencePracticeApiService } from "../../core/sentence-practice/sentence-practice-api.service";
import type {
	SentencePracticeCard,
	SentencePracticeDeck,
} from "../../domain/sentence-practice/sentence-practice";
import type {
	ClozeSlideData,
	DictationSlideData,
	PronunciationSlideData,
	SlideExerciseSlide,
} from "../../shared/slide-exercise";

export type PracticeWordsMode =
	"vocabulary-dictation" | "sentence-completion" | "sentence-shadowing";

interface HouseOneWord {
	readonly id: string;
	readonly term: string;
	readonly accepted: readonly string[];
}

interface HouseOneSnapshot {
	readonly words: readonly HouseOneWord[];
}

function acceptedAnswers(word: HouseOneWord): readonly string[] {
	return [
		...new Set(
			[word.term, ...word.accepted]
				.map((value) => value.trim())
				.filter(Boolean),
		),
	];
}

function sentenceCards(
	deck: SentencePracticeDeck,
	words: readonly HouseOneWord[],
): ReadonlyMap<string, SentencePracticeCard> {
	const cards = new Map(deck.cards.map((card) => [card.id, card]));
	const missing = words.filter((word) => !cards.get(word.id)?.sentences[0]);
	if (missing.length) {
		throw new Error(
			`Sentence practice is unavailable for ${missing.length} House 1 ${missing.length === 1 ? "word" : "words"}.`,
		);
	}
	return cards;
}

function wordDefinitions(
	deck: SentencePracticeDeck,
	words: readonly HouseOneWord[],
): ReadonlyMap<string, string> {
	const definitions = new Map(
		deck.cards.map((card) => [
			card.id,
			card.definitions
				?.map((definition) => definition.text.trim())
				.find(Boolean) ?? "",
		]),
	);
	const missing = words.filter((word) => !definitions.get(word.id));
	if (missing.length) {
		throw new Error(
			`Definitions are unavailable for ${missing.length} House 1 ${missing.length === 1 ? "word" : "words"}.`,
		);
	}
	return definitions;
}

function slideId(
	anchorId: string,
	mode: PracticeWordsMode,
	wordId: string,
): string {
	return `${anchorId}-${mode}-${wordId}`;
}

@Injectable({ providedIn: "root" })
export class PracticeWordsSlideBuilderService {
	private readonly learningApi = inject(LearningApiService);
	private readonly sentenceApi = inject(SentencePracticeApiService);

	async build(
		anchorId: string,
		mode: string,
	): Promise<readonly SlideExerciseSlide[]> {
		if (
			mode !== "vocabulary-dictation" &&
			mode !== "sentence-completion" &&
			mode !== "sentence-shadowing"
		) {
			throw new Error(`Unsupported practice mode: ${String(mode)}`);
		}
		const house = await this.learningApi.getHouse<HouseOneSnapshot>(1);
		const words = house.words.filter(
			(word) => word.id.trim() && word.term.trim(),
		);
		if (!words.length)
			throw new Error(
				"Add words to House 1 before starting this practice.",
			);
		const deck = await this.sentenceApi.getDeck(1);
		if (mode === "vocabulary-dictation")
			return this.dictationSlides(
				anchorId,
				words,
				wordDefinitions(deck, words),
			);
		const cards = sentenceCards(deck, words);
		return mode === "sentence-completion"
			? this.completionSlides(anchorId, words, cards)
			: this.shadowingSlides(anchorId, words, cards);
	}

	private dictationSlides(
		anchorId: string,
		words: readonly HouseOneWord[],
		definitions: ReadonlyMap<string, string>,
	): readonly SlideExerciseSlide[] {
		return words.map((word) => ({
			id: slideId(anchorId, "vocabulary-dictation", word.id),
			rootSlideId: slideId(anchorId, "vocabulary-dictation", word.id),
			itemId: word.id,
			type: "dictation",
			data: {
				mode: "phrase",
				instruction: "Listen and type the word or collocation.",
				speech: { text: word.term, autoplay: true, replay: true },
				answer: word.term,
				definition: definitions.get(word.id)!,
				acceptedAnswers: acceptedAnswers(word),
				caseSensitive: false,
				punctuationSensitive: false,
			} satisfies DictationSlideData,
		}));
	}

	private completionSlides(
		anchorId: string,
		words: readonly HouseOneWord[],
		cards: ReadonlyMap<string, SentencePracticeCard>,
	): readonly SlideExerciseSlide[] {
		return words.map((word) => {
			const card = cards.get(word.id)!;
			const sentence = card.sentences[0];
			const id = slideId(anchorId, "sentence-completion", word.id);
			return {
				id,
				rootSlideId: id,
				itemId: word.id,
				type: "cloze",
				data: {
					instruction:
						"Listen to the missing word or collocation and complete the sentence.",
					stimulus: {
						type: "dialogue",
						turns: [{ speaker: "Missing word", text: word.term }],
					},
					content: `${sentence.before}{{answer}}${sentence.after}`,
					inputMode: "text",
					blanks: [
						{
							id: "answer",
							answers: acceptedAnswers(word),
							definitions:
								card.definitions?.map(
									(definition) => definition.text,
								) ?? [],
							caseSensitive: false,
							punctuationSensitive: false,
						},
					],
				} satisfies ClozeSlideData,
			};
		});
	}

	private shadowingSlides(
		anchorId: string,
		words: readonly HouseOneWord[],
		cards: ReadonlyMap<string, SentencePracticeCard>,
	): readonly SlideExerciseSlide[] {
		return words.map((word) => {
			const sentence = cards.get(word.id)!.sentences[0];
			const id = slideId(anchorId, "sentence-shadowing", word.id);
			return {
				id,
				rootSlideId: id,
				itemId: word.id,
				type: "pronunciation",
				data: {
					mode: "repeat",
					instruction:
						"Listen, then repeat the complete sentence aloud.",
					question: sentence.text,
					word: word.term,
					stimulus: {
						type: "dialogue",
						turns: [{ speaker: "Sentence", text: sentence.text }],
					},
				} satisfies PronunciationSlideData,
			};
		});
	}
}
