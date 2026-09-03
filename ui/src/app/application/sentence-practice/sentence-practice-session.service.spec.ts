import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { SentenceAudioService } from '../../core/audio/sentence-audio.service';
import { SentencePracticeApiService } from '../../core/sentence-practice/sentence-practice-api.service';
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
			sourceItemNumber: variantNumber,
			variantNumber: 1,
			category: 'Tatoeba',
			text: `My name is Mohammad ${variantNumber}.`,
			before: 'My ',
			after: ` is Mohammad ${variantNumber}.`,
			audioId: `audio-${variantNumber}`,
			audioUrl: `https://tatoeba.org/audio/download/${variantNumber}`,
			audioContributor: 'speaker',
			audioLicense: 'CC BY 4.0',
			audioAttributionUrl: 'https://example.test/speaker',
		})),
	}],
};

describe('SentencePracticeSessionService', () => {
	const sentenceApi = { getDeck: vi.fn() };
	const learningApi = {
		startSession: vi.fn(),
		completeSession: vi.fn(),
		abandonSession: vi.fn(),
	};
	const audio = { play: vi.fn(() => true), stop: vi.fn() };
	const storeState = { settings: { voiceRate: .85 } };
	const store = {
		initialize: vi.fn(),
		snapshot: vi.fn(() => storeState),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		sentenceApi.getDeck.mockResolvedValue(structuredClone(deck));
		learningApi.startSession.mockResolvedValue({ session: { id: 'session-1' } });
		learningApi.completeSession.mockResolvedValue({});
		learningApi.abandonSession.mockResolvedValue({});
		store.initialize.mockResolvedValue(storeState);
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				SentencePracticeSessionService,
				{ provide: SentencePracticeApiService, useValue: sentenceApi },
				{ provide: LearningApiService, useValue: learningApi },
				{ provide: SentenceAudioService, useValue: audio },
				{ provide: LearningStoreService, useValue: store },
			],
		});
	});

	it('plays the full human-recorded sentence URL instead of speaking the target word', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		await service.start(1);
		const url = service.currentPrompt()!.sentence.audioUrl;

		expect(service.playSentence()).toBe(true);
		expect(audio.play).toHaveBeenCalledWith(url, 1);
		expect(service.playSentence(.75)).toBe(true);
		expect(audio.play).toHaveBeenLastCalledWith(url, .75);
	});

	it('rechecks a wrong answer with a different sentence without recording a Leitner review', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);

		expect(await service.start(1)).toBe(true);
		expect(learningApi.startSession).toHaveBeenCalledWith('sentence-house-1', 1);
		const firstSentenceId = service.currentPrompt()!.sentence.id;

		service.submit('wrong');
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

		service.submit('NAME');
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

	it('always clears local state and sentence audio when abandoning, even if the session endpoint fails', async () => {
		const service = TestBed.inject(SentencePracticeSessionService);
		await service.start(1);
		learningApi.abandonSession.mockRejectedValueOnce(new Error('offline'));

		await expect(service.abandon()).rejects.toThrow('offline');

		expect(service.active()).toBe(false);
		expect(service.currentPrompt()).toBeNull();
		expect(service.feedback()).toBeNull();
		expect(audio.stop).toHaveBeenCalled();
	});
});
