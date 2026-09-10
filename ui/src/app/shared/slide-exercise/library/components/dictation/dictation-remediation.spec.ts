import { describe, expect, it } from 'vitest';
import { DictationRemediationAttempt, DictationRemediationPhase } from './dictation-remediation';

describe('dictation spelling remediation', () => {
	it('copies the correction, recall, copy, and final recall rules locally', () => {
		const attempt = DictationRemediationAttempt.start({
			accepted: ['december'],
			initialAnswer: 'desmber',
			matches: (answer) => answer === 'december',
		});

		expect(attempt.phase).toBe(DictationRemediationPhase.CORRECTION);
		expect(attempt.snapshot()).toMatchObject({
			answerVisible: true,
			comparison: { answer: 'desmber', target: 'december' },
		});

		attempt.acknowledgeCorrection();
		expect(attempt.phase).toBe(DictationRemediationPhase.RECALL);
		expect(attempt.snapshot().answerVisible).toBe(false);

		expect(attempt.submitRecall('decembr')).toBe(false);
		expect(attempt.phase).toBe(DictationRemediationPhase.COPY);
		expect(attempt.snapshot()).toMatchObject({
			answerVisible: true,
			recallFailures: 1,
			comparison: { answer: 'decembr', target: 'december' },
		});

		expect(attempt.submitCopy('decemberr')).toBe(false);
		expect(attempt.phase).toBe(DictationRemediationPhase.COPY);
		expect(attempt.snapshot()).toMatchObject({
			copyFailures: 1,
			comparison: { answer: 'decemberr', target: 'december' },
		});

		expect(attempt.submitCopy('december')).toBe(true);
		expect(attempt.phase).toBe(DictationRemediationPhase.RECALL);
		expect(attempt.submitRecall('december')).toBe(true);
		expect(attempt.phase).toBe(DictationRemediationPhase.COMPLETED);
	});

	it('keeps the copied spelling comparison tokens used by the review screen', () => {
		const attempt = DictationRemediationAttempt.start({
			accepted: ['december'],
			initialAnswer: 'desmber',
			matches: (answer) => answer === 'december',
		});
		const comparison = attempt.snapshot().comparison;

		expect(comparison.answerTokens.map((token) => token.value).join('')).toBe('desmber');
		expect(comparison.targetTokens.map((token) => token.value).join('')).toBe('december');
		expect(comparison.answerTokens.some((token) => token.status === 'changed')).toBe(true);
		expect(comparison.targetTokens.some((token) => token.status === 'changed')).toBe(true);
	});
});
