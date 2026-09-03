import { describe, expect, it } from 'vitest';
import { SentencePracticeCard, SentencePracticeQueue } from './sentence-practice';

function card(id: string): SentencePracticeCard {
	return {
		id,
		term: id,
		accepted: [id],
		box: 1,
		mistakes: 0,
		sentences: [1, 2, 3].map((variant) => ({
			id: `${id}-sentence-${variant}`,
			sourceItemNumber: variant,
			variantNumber: variant,
			category: 'Test',
			text: `Before ${id} after ${variant}.`,
			before: 'Before ',
			after: ` after ${variant}.`,
		})),
	};
}

describe('SentencePracticeQueue free-practice loop', () => {
	it('keeps House 1 practice running after every primary card has been shown once', () => {
		const queue = new SentencePracticeQueue([card('one'), card('two'), card('three')], 3, () => 0, true);
		const firstCycle = [queue.next(), queue.next(), queue.next()];
		const nextCycleCard = queue.next();

		expect(firstCycle.every(Boolean)).toBe(true);
		expect(new Set(firstCycle.map((prompt) => prompt!.card.id)).size).toBe(3);
		expect(nextCycleCard).not.toBeNull();
		expect(nextCycleCard!.primary).toBe(true);
		expect(nextCycleCard!.card.id).not.toBe(firstCycle.at(-1)!.card.id);
	});

	it('preserves the three-card retry gap even when a wrong answer happens at a cycle boundary', () => {
		const queue = new SentencePracticeQueue(
			[card('name'), card('one'), card('two'), card('three')],
			3,
			() => 0,
			true,
		);
		const prompts = [queue.next(), queue.next(), queue.next(), queue.next()];
		const failed = prompts.at(-1)!;
		queue.scheduleRetry(failed);

		const intervening = [queue.next(), queue.next(), queue.next()];
		const retry = queue.next();
		expect(intervening.every((prompt) => prompt?.card.id !== failed.card.id)).toBe(true);
		expect(retry?.card.id).toBe(failed.card.id);
		expect(retry?.retryNumber).toBe(1);
		expect(retry?.sentence.id).not.toBe(failed.sentence.id);
	});
});
