import {describe, expect, it} from 'vitest';
import {RemediationContext, RemediationPhase} from '../../domain/remediation/remediation';
import {resolveReviewContextBadge} from './review-context-badge.component';

describe('review remediation context badge', () => {
	it('labels the original correction as spelling correction', () => {
		expect(resolveReviewContextBadge({
			phase: RemediationPhase.CORRECTION,
			context: RemediationContext.IMMEDIATE,
		})).toEqual({
			kind: 'spelling-correction',
			icon: 'mistake',
			label: 'SPELLING CORRECTION',
		});
	});

	it('labels immediate hidden-answer practice as recall from memory', () => {
		expect(resolveReviewContextBadge({
			phase: RemediationPhase.RECALL,
			context: RemediationContext.IMMEDIATE,
		})).toEqual({
			kind: 'recall-from-memory',
			icon: 'memory',
			label: 'RECALL FROM MEMORY',
		});
	});

	it('keeps recall context visible after a correct immediate recall', () => {
		expect(resolveReviewContextBadge({
			phase: RemediationPhase.COMPLETED,
			context: RemediationContext.IMMEDIATE,
		})).toEqual({
			kind: 'recall-from-memory',
			icon: 'memory',
			label: 'RECALL FROM MEMORY',
		});
	});

	it('distinguishes a delayed mistake recheck from immediate recall', () => {
		expect(resolveReviewContextBadge({
			phase: RemediationPhase.RECALL,
			context: RemediationContext.RECHECK,
		})).toEqual({
			kind: 'mistake-recheck',
			icon: 'recheck',
			label: 'MISTAKE RECHECK',
		});
	});

	it('keeps mistake recheck visible after the recheck is answered correctly', () => {
		expect(resolveReviewContextBadge({
			phase: RemediationPhase.COMPLETED,
			context: RemediationContext.RECHECK,
		})).toEqual({
			kind: 'mistake-recheck',
			icon: 'recheck',
			label: 'MISTAKE RECHECK',
		});
	});

	it('uses copy context whenever the learner can see and copy the correction', () => {
		expect(resolveReviewContextBadge({
			phase: RemediationPhase.COPY,
			context: RemediationContext.RECHECK,
		})).toEqual({
			kind: 'copy-correction',
			icon: 'copy',
			label: 'COPY THE CORRECTION',
		});
	});

	it('hides the context badge when no remediation is active', () => {
		expect(resolveReviewContextBadge(null)).toBeNull();
	});
});
