import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningApiService } from "../../core/learning/learning-api.service";
import { SentencePracticeApiService } from "../../core/sentence-practice/sentence-practice-api.service";
import { PracticeWordsSlideBuilderService } from "./practice-words-slide-builder.service";

const house = {
	house: { number: 1, reviewIntervalDays: 1, stateCount: 1 },
	summary: { totalWords: 2, dueWords: 2, totalMistakes: 0, totalAttempts: 0 },
	words: [
		{ id: "word-1", term: "make progress", accepted: ["make progress"] },
		{ id: "word-2", term: "persistent", accepted: ["persistent"] },
	],
};

const sentences = {
	practice: { mode: "sentence" as const, house: 1, retryGap: 3 },
	summary: { totalWords: 2, totalSentences: 2 },
	cards: [
		{
			id: "word-1",
			term: "make progress",
			accepted: ["make progress"],
			box: 1,
			mistakes: 0,
			definitions: [
				{
					id: "definition-1",
					text: "move towards a goal",
					languageCode: "en",
					collectionTitle: "Test",
				},
			],
			sentences: [
				{
					id: "sentence-1",
					sourceItemNumber: 1,
					variantNumber: 1,
					category: "test",
					text: "You can make progress every day.",
					before: "You can ",
					after: " every day.",
				},
			],
		},
		{
			id: "word-2",
			term: "persistent",
			accepted: ["persistent"],
			box: 1,
			mistakes: 0,
			definitions: [
				{
					id: "definition-2",
					text: "continuing despite difficulty",
					languageCode: "en",
					collectionTitle: "Test",
				},
			],
			sentences: [
				{
					id: "sentence-2",
					sourceItemNumber: 2,
					variantNumber: 1,
					category: "test",
					text: "She is persistent.",
					before: "She is ",
					after: ".",
				},
			],
		},
	],
};

function setup(sentenceDeck = sentences) {
	const learningApi = { getHouse: vi.fn().mockResolvedValue(house) };
	const sentenceApi = { getDeck: vi.fn().mockResolvedValue(sentenceDeck) };
	TestBed.configureTestingModule({
		providers: [
			PracticeWordsSlideBuilderService,
			{ provide: LearningApiService, useValue: learningApi },
			{ provide: SentencePracticeApiService, useValue: sentenceApi },
		],
	});
	return {
		builder: TestBed.inject(PracticeWordsSlideBuilderService),
		learningApi,
		sentenceApi,
	};
}

describe("PracticeWordsSlideBuilderService", () => {
	beforeEach(() => {
		vi.spyOn(Math, "random").mockReturnValue(0.999);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([
		"vocabulary-dictation",
		"sentence-completion",
		"sentence-shadowing",
	] as const)("shuffles House 1 words before building %s slides", async (mode) => {
		const { builder } = setup();
		vi.mocked(Math.random).mockReturnValue(0);

		const slides = await builder.build("practice-mode", mode);

		expect(slides.map((slide) => slide.itemId)).toEqual([
			"word-2",
			"word-1",
		]);
	});

	it("builds one reusable dictation slide for every House 1 word", async () => {
		const { builder, learningApi, sentenceApi } = setup();

		const slides = await builder.build(
			"practice-mode",
			"vocabulary-dictation",
		);

		expect(learningApi.getHouse).toHaveBeenCalledWith(1);
		expect(sentenceApi.getDeck).toHaveBeenCalledWith(1);
		expect(slides).toHaveLength(2);
		expect(slides[0]).toMatchObject({
			id: "practice-mode-vocabulary-dictation-word-1",
			itemId: "word-1",
			type: "dictation",
			data: {
				mode: "phrase",
				answer: "make progress",
				definition: "move towards a goal",
				acceptedAnswers: ["make progress"],
				speech: { text: "make progress", autoplay: true, replay: true },
			},
		});
		expect(slides.map((slide) => slide.data)).toMatchObject([
			{ definition: "move towards a goal" },
			{ definition: "continuing despite difficulty" },
		]);
	});

	it("does not build a dictation deck when any House 1 definition is unavailable", async () => {
		const { builder } = setup({
			...sentences,
			cards: sentences.cards.map((card) =>
				card.id === "word-2" ? { ...card, definitions: [] } : card,
			),
		});

		await expect(
			builder.build("practice-mode", "vocabulary-dictation"),
		).rejects.toThrow("Definitions are unavailable for 1 House 1 word.");
	});

	it("builds dictation for a defined House 1 word without a matching sentence", async () => {
		const { builder } = setup({
			...sentences,
			cards: sentences.cards.map((card) =>
				card.id === "word-2" ? { ...card, sentences: [] } : card,
			),
		});

		const slides = await builder.build(
			"practice-mode",
			"vocabulary-dictation",
		);

		expect(slides).toHaveLength(2);
		expect(slides[1].data).toMatchObject({
			answer: "persistent",
			definition: "continuing despite difficulty",
		});
	});

	it("builds one audio-led cloze slide for every House 1 word", async () => {
		const { builder } = setup();

		const slides = await builder.build(
			"practice-mode",
			"sentence-completion",
		);

		expect(slides).toHaveLength(2);
		expect(slides[0]).toMatchObject({
			id: "practice-mode-sentence-completion-word-1",
			itemId: "word-1",
			type: "cloze",
			data: {
				showOptions: false,
				content: "You can {{answer}} every day.",
				speech: { text: "You can make progress every day." },
				blanks: [
					{
						id: "answer",
						answers: ["make progress"],
						definitions: ["move towards a goal"],
					},
				],
			},
		});
		expect(slides[0].data).not.toHaveProperty("stimulus");
	});

	it("builds one sentence-repeat pronunciation slide for every House 1 word", async () => {
		const { builder } = setup();

		const slides = await builder.build(
			"practice-mode",
			"sentence-shadowing",
		);

		expect(slides).toHaveLength(2);
		expect(slides[1]).toMatchObject({
			id: "practice-mode-sentence-shadowing-word-2",
			itemId: "word-2",
			type: "pronunciation",
			data: {
				mode: "repeat",
				question: "She is persistent.",
				speech: { text: "She is persistent." },
				recording: { itemId: "word-2", promptId: "sentence-2" },
			},
		});
		expect(slides[1].data).not.toHaveProperty("stimulus");
	});

	it("fails closed when a sentence mode cannot cover every House 1 word", async () => {
		const { builder, sentenceApi } = setup();
		sentenceApi.getDeck.mockResolvedValue({
			...sentences,
			cards: sentences.cards.slice(0, 1),
		});

		await expect(
			builder.build("practice-mode", "sentence-completion"),
		).rejects.toThrow(
			"Sentence practice is unavailable for 1 House 1 word.",
		);
	});

	it("rejects a practice mode that the parent did not register", async () => {
		const { builder, learningApi } = setup();

		await expect(
			builder.build("practice-mode", "unknown-mode"),
		).rejects.toThrow("Unsupported practice mode: unknown-mode");
		expect(learningApi.getHouse).not.toHaveBeenCalled();
	});

	it("does not create an empty exercise when House 1 has no words", async () => {
		const { builder, learningApi } = setup();
		learningApi.getHouse.mockResolvedValue({ ...house, words: [] });

		await expect(
			builder.build("practice-mode", "vocabulary-dictation"),
		).rejects.toThrow(
			"Add words to House 1 before starting this practice.",
		);
	});
});
