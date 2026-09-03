import { describe, expect, it } from 'vitest';
import {
	SentencePracticeCard,
	SentencePracticeQueue,
	isAcceptedSentenceAnswer,
	normalizeSentenceAnswer,
} from './sentence-practice';

function card(id: string, term = id): SentencePracticeCard {
	return {
		id,
		term,
		accepted: [term],
		box: 1,
		mistakes: 0,
		sentences: [1, 2, 3].map((variant) => ({
			id: `${id}-sentence-${variant}`,
			sourceItemNumber: variant,
			variantNumber: 1,
			category: 'Tatoeba',
			text: `Before ${term} after ${variant}.`,
			before: 'Before ',
			after: ` after ${variant}.`,
			audioId: `${variant}`,
			audioUrl: `https://tatoeba.org/audio/download/${variant}`,
			audioContributor: 'speaker',
			audioLicense: 'CC BY 4.0',
			audioAttributionUrl: null,
		})),
	};
}

describe('sentence-practice domain', () => {
	it('normalizes casing, spacing, curly apostrophes and dash variants', () => {
		expect(normalizeSentenceAnswer("  Mother’s   day  ")).toBe("mother's day");
		expect(isAcceptedSentenceAnswer('part–time', ['part-time'])).toBe(true);
		expect(isAcceptedSentenceAnswer('COLOR', ['colour', 'color'])).toBe(true);
		expect(isAcceptedSentenceAnswer('', ['name'])).toBe(false);
	});

	it('shows a failed word again after three other cards with a different sentence', () => {
		const queue = new SentencePracticeQueue(
			[card('name'), card('one'), card('two'), card('three'), card('four')],
			3,
			() => 0,
		);
		const first = queue.next();
		expect(first).not.toBeNull();
		queue.scheduleRetry(first!);

		const intervening = [queue.next(), queue.next(), queue.next()];
		const retry = queue.next();

		expect(intervening.every((prompt) => prompt?.card.id !== first!.card.id)).toBe(true);
		expect(retry?.card.id).toBe(first!.card.id);
		expect(retry?.primary).toBe(false);
		expect(retry?.retryNumber).toBe(1);
		expect(retry?.sentence.id).not.toBe(first!.sentence.id);
	});

	it('flushes a retry at the end of a short finite deck and can schedule it again', () => {
		const queue = new SentencePracticeQueue([card('name')], 3, () => 0);
		const primary = queue.next()!;
		queue.scheduleRetry(primary);
		const firstRetry = queue.next()!;
		expect(firstRetry.retryNumber).toBe(1);
		queue.scheduleRetry(firstRetry);
		const secondRetry = queue.next()!;
		expect(secondRetry.retryNumber).toBe(2);
		expect(secondRetry.sentence.id).not.toBe(firstRetry.sentence.id);
		expect(queue.next()).toBeNull();
	});
});
