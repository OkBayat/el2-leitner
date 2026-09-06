import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { SentencePracticeApiService } from '../../core/sentence-practice/sentence-practice-api.service';
import { SpeechService } from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { SentencePracticeDeck } from '../../domain/sentence-practice/sentence-practice';
import { SentencePracticeSessionService } from './sentence-practice-session.service';

const deck: SentencePracticeDeck = {
	practice: { mode: 'sentence', house: 1, retryGap: 3 },
	summary: { totalWords: 1, totalSentences: 3 },
	cards: [{
		id: 'word-name',
		term: 'name',
		accepted: ['name'],
		box: 1,
		mistakes: 0,
		sentences: [1, 2, 3].map((variantNumber) => ({
			id: `sentence-${variantNumber}`,
			sourceItemNumber: 1,
			variantNumber,
			category: 'Personal details and form completion',
			text: `My name is Mohammad ${variantNumber}.`,
			before: 'My ',
			after: ` is Mohammad ${variantNumber}.`,
		})),
	}],
};

describe('SentencePracticeSessionService', () => {
	const sentenceApi = { getDeck: vi.fn() };
	const learningApi = {
		startSession: vi.fn(),
		recordSessionAttempt: vi.fn(),
		completeSession: vi.fn(),
		abandonSession: vi.fn(),
	};
	const speech = { speak: vi.fn(), cancel: vi.fn() };
	const storeState = { settings: { voiceRate: .85 }, daily: {} };
	const store = {
		initialize: vi.fn(),
		snapshot: vi.fn(() => structuredClone(storeState)),
		replaceLocal: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		sentenceApi.getDeck.mockResolvedValue(structuredClone(deck));
		learningApi.startSession.mockResolvedValue({ session: { id: 'session-1' } });
		learningApi.recordSessionAttempt.mockResolvedValue({
			daily: { day: '2026-09-03', attempts: 1, correct: 1, wrong: 0, newAdded: 0, sessions: 0, durationSeconds: 0 },
		});
		learningApi.completeSession.mockResolvedValue({});
		learningApi.abandonSession.mockResolvedValue({});
		speech.speak.mockReturnValue(true);
		store.initialize.mockResolvedValue(storeState);
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				SentencePracticeSessionService,
				{ provide: SentencePracticeApiService, useValue: sentenceApi },
				{ provide: LearningApiService, useValue: learningApi },
				{ provide: SpeechService, useValue: speech },
				{ provide: LearningStoreService, useValue: store },
			],
		});
	});

	it('pronounces the full active sentence at normal and slower rates', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		expect(await service.start(1)).toBe(true);
		const prompt = service.currentPrompt()!;

		expect(prompt.sentence.text).not.toBe(prompt.card.term);
		expect(service.pronounce()).toBe(true);
		expect(speech.speak).toHaveBeenLastCalledWith(
			prompt.sentence.text,
			.85,
			expect.objectContaining({
				onStart: expect.any(Function),
				onWordBoundary: expect.any(Function),
				onEnd: expect.any(Function),
			}),
		);

		expect(service.pronounce(.75)).toBe(true);
		expect(speech.speak).toHaveBeenLastCalledWith(
			prompt.sentence.text,
			.85 * .75,
			expect.objectContaining({
				onStart: expect.any(Function),
				onWordBoundary: expect.any(Function),
				onEnd: expect.any(Function),
			}),
		);
	});

	it('tracks spoken progress and keeps the sentence fully revealed when speech ends', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		await service.start(1);
		const prompt = service.currentPrompt()!;
		service.pronounce();
		const observer = speech.speak.mock.calls.at(-1)?.[2] as {
			onStart: () => void;
			onWordBoundary: (charIndex: number, charLength: number) => void;
			onEnd: () => void;
		};

		expect(service.playbackActive()).toBe(false);
		expect(service.playbackCharIndex()).toBeNull();

		observer.onStart();
		expect(service.playbackActive()).toBe(true);
		expect(service.playbackCharIndex()).toBeNull();

		observer.onWordBoundary(3, 4);
		expect(service.playbackActive()).toBe(true);
		expect(service.playbackCharIndex()).toBe(3);

		observer.onEnd();
		expect(service.playbackActive()).toBe(false);
		expect(service.playbackCharIndex()).toBe(prompt.sentence.text.trim().length);
	});

	it('records each sentence answer in daily practice totals without using review persistence', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		await service.start(1);
		await service.submit('name');

		expect(learningApi.recordSessionAttempt).toHaveBeenCalledWith('session-1', {
			day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
			correct: true,
		});
		expect(store.replaceLocal).toHaveBeenCalledWith(expect.objectContaining({
			daily: expect.objectContaining({
				'2026-09-03': expect.objectContaining({ attempts: 1, correct: 1, wrong: 0 }),
			}),
		}));
	});

	it('keeps House 1 sentence practice active after the first deck cycle', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		await service.start(1);
		await service.submit('name');
		await service.next();

		expect(service.freePractice()).toBe(true);
		expect(service.active()).toBe(true);
		expect(service.completed()).toBe(false);
		expect(service.currentPrompt()).not.toBeNull();
	});

	it('rechecks a wrong answer with a different sentence without recording a Leitner review', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);

		expect(await service.start(2)).toBe(true);
		expect(learningApi.startSession).toHaveBeenCalledWith('sentence-house-2', 1);
		const firstSentenceId = service.currentPrompt()!.sentence.id;

		learningApi.recordSessionAttempt.mockResolvedValueOnce({
			daily: { day: '2026-09-03', attempts: 1, correct: 0, wrong: 1, newAdded: 0, sessions: 0, durationSeconds: 0 },
		});
		await service.submit('wrong');
		expect(service.feedback()).toEqual({
			correct: false,
			submittedAnswer: 'wrong',
			correctAnswer: 'name',
		});
		expect(service.primaryAnswered()).toBe(1);
		expect(service.progress()).toBe(100);

		await service.next();
		expect(service.currentPrompt()!.primary).toBe(false);
		expect(service.currentPrompt()!.retryNumber).toBe(1);
		expect(service.currentPrompt()!.sentence.id).not.toBe(firstSentenceId);

		await service.submit('NAME');
		await service.next();

		expect(service.completed()).toBe(true);
		expect(service.active()).toBe(false);
		expect(learningApi.completeSession).toHaveBeenCalledWith('session-1', expect.objectContaining({
			completedCount: 2,
			correctCount: 1,
			wrongCount: 1,
		}));
		expect(learningApi.startSession).toHaveBeenCalledTimes(1);
		expect(learningApi.completeSession).toHaveBeenCalledTimes(1);
		expect(learningApi.abandonSession).not.toHaveBeenCalled();
	});

	it('returns false and does not create a session when the selected house has no covered cards', async () => {
		sentenceApi.getDeck.mockResolvedValue({
			practice: { mode: 'sentence', house: 1, retryGap: 3 },
			summary: { totalWords: 0, totalSentences: 0 },
			cards: [],
		});
		const service = TestBed.inject(SentencePracticeSessionService);

		expect(await service.start(1)).toBe(false);
		expect(service.active()).toBe(false);
		expect(service.completed()).toBe(false);
		expect(learningApi.startSession).not.toHaveBeenCalled();
	});

	it('always clears local state when abandoning, even if the session endpoint fails', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		await service.start(1);
		learningApi.abandonSession.mockRejectedValueOnce(new Error('offline'));

		await expect(service.abandon()).rejects.toThrow('offline');

		expect(service.active()).toBe(false);
		expect(service.currentPrompt()).toBeNull();
		expect(service.feedback()).toBeNull();
		expect(speech.cancel).toHaveBeenCalled();
	});
});
