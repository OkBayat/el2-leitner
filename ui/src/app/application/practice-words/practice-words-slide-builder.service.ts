import { Injectable, inject } from "@angular/core";
import { LearningApiService } from "../../core/learning/learning-api.service";
import { SentencePracticeApiService } from "../../core/sentence-practice/sentence-practice-api.service";
import type {
	SentencePracticeCard,
	SentencePracticeDeck,
} from "../../domain/sentence-practice/sentence-practice";
import type { ShadowingCard } from "../../domain/shadowing-practice/shadowing";
import type {
	ClozeSlideData,
	PronunciationSlideData,
	SlideExerciseSlide,
} from "../../shared/slide-exercise";
import { LeitnerDictationSlideBuilderService } from "../review/leitner-dictation-slide-builder.service";

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

function shuffledWords(words: readonly HouseOneWord[]): readonly HouseOneWord[] {
	const result = [...words];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1));
		[result[index], result[target]] = [result[target], result[index]];
	}
	return result;
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

function shadowingCardMap(
	cards: readonly ShadowingCard[],
	words: readonly HouseOneWord[],
): ReadonlyMap<string, ShadowingCard> {
	const mapped = new Map(cards.map((card) => [card.id, card]));
	const missing = words.filter((word) => !mapped.get(word.id)?.sentences[0]);
	if (missing.length) {
		throw new Error(
			`Sentence shadowing is unavailable for ${missing.length} House 1 ${missing.length === 1 ? "word" : "words"}.`,
		);
	}
	return mapped;
}

function wordDefinitions(
	deck: SentencePracticeDeck,
	words: readonly HouseOneWord[],
): ReadonlyMap<string, string> {
	const available = new Map(
		deck.cards.map((card) => [
			card.id,
			card.definitions
				?.map((definition) => definition.text.trim())
				.find(Boolean) ?? "",
		]),
	);
	return new Map(words.map((word) => [word.id, available.get(word.id) ?? ""]));
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
	private readonly dictationBuilder = inject(LeitnerDictationSlideBuilderService);

	async build(
		anchorId: string,
		mode: string,
		shadowingCards?: readonly ShadowingCard[],
	): Promise<readonly SlideExerciseSlide[]> {
		if (
			mode !== "vocabulary-dictation" &&
			mode !== "sentence-completion" &&
			mode !== "sentence-shadowing"
		) {
			throw new Error(`Unsupported practice mode: ${String(mode)}`);
		}
		const house = await this.learningApi.getHouse<HouseOneSnapshot>(1);
		const words = shuffledWords(
			house.words.filter((word) => word.id.trim() && word.term.trim()),
		);
		if (!words.length)
			throw new Error(
				"Add words to House 1 before starting this practice.",
			);
		if (mode === "sentence-shadowing") {
			if (!shadowingCards) {
				throw new Error("Sentence shadowing requires an active recording session.");
			}
			return this.shadowingSlides(
				anchorId,
				words,
				shadowingCardMap(shadowingCards, words),
			);
		}
		const deck = await this.sentenceApi.getDeck(1);
		if (mode === "vocabulary-dictation")
			return this.dictationBuilder.build(
				anchorId,
				words,
				wordDefinitions(deck, words),
				false,
			);
		const cards = sentenceCards(deck, words);
		return this.completionSlides(anchorId, words, cards);
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
					speech: { text: sentence.text },
					content: `${sentence.before}{{answer}}${sentence.after}`,
					inputMode: "text",
					showOptions: false,
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
		cards: ReadonlyMap<string, ShadowingCard>,
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
					speech: { text: sentence.text },
					recording: { itemId: word.id, promptId: sentence.id },
				} satisfies PronunciationSlideData,
			};
		});
	}
}
