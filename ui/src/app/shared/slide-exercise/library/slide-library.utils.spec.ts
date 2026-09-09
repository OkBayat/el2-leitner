import { describe, expect, it } from 'vitest';
import { parseStimulus } from './slide-library.utils';

describe('slide stimulus parsing', () => {
	it('parses a multi-turn dialogue and assigns deterministic voice indexes', () => {
		expect(
			parseStimulus({
				type: 'dialogue',
				maxReplays: 2,
				turns: [
					{
						speaker: 'Host',
						text: 'Listen carefully.',
						voiceIndex: 3,
					},
					{ speaker: 'Learner', text: 'I am ready.' },
				],
			}),
		).toEqual({
			type: 'dialogue',
			maxReplays: 2,
			turns: [
				{ speaker: 'Host', text: 'Listen carefully.', voiceIndex: 3 },
				{ speaker: 'Learner', text: 'I am ready.', voiceIndex: 1 },
			],
		});
	});

	it('parses a single spoken turn for audio-led practice', () => {
		expect(
			parseStimulus({
				type: 'dialogue',
				turns: [{ speaker: 'Sentence', text: 'Repeat this sentence.' }],
			}),
		).toEqual({
			type: 'dialogue',
			turns: [
				{
					speaker: 'Sentence',
					text: 'Repeat this sentence.',
					voiceIndex: 0,
				},
			],
		});
	});
});
