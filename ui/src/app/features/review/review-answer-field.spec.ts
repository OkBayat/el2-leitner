import {describe, expect, it} from 'vitest';
import {RemediationPhase} from '../../domain/remediation/remediation';
import {buildReviewAnswerFieldState} from './review-answer-field';

describe('review answer field state', () => {
	it('does not render outside an active session or during spelling correction', () => {
		expect(buildReviewAnswerFieldState({
			active: false,
			currentTask: 'review',
			hasFeedback: false,
			remediationPhase: null,
		})).toBeNull();
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			hasFeedback: true,
			remediationPhase: RemediationPhase.CORRECTION,
		})).toBeNull();
	});

	it('keeps the normal review answer visible and locks it after correct feedback', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			hasFeedback: false,
			remediationPhase: null,
		})).toEqual({label: 'Your answer', action: 'review', disabled: false});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			hasFeedback: true,
			remediationPhase: null,
		})).toEqual({label: 'Your answer', action: 'review', disabled: true});
	});

	it('uses the same field for recall, copy, and completed immediate remediation', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			hasFeedback: true,
			remediationPhase: RemediationPhase.RECALL,
		})).toEqual({label: 'Recall from memory', action: 'remediation', disabled: false});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			hasFeedback: true,
			remediationPhase: RemediationPhase.COPY,
		})).toEqual({label: 'Exact copy', action: 'remediation', disabled: false});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			hasFeedback: true,
			remediationPhase: RemediationPhase.COMPLETED,
		})).toEqual({label: 'Recall from memory', action: 'remediation', disabled: true});
	});

	it('keeps the same recall field through a scheduled recheck and locks the submitted answer on success', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'recheck',
			hasFeedback: false,
			remediationPhase: RemediationPhase.RECALL,
		})).toEqual({label: 'Recall from memory', action: 'remediation', disabled: false});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'recheck',
			hasFeedback: false,
			remediationPhase: RemediationPhase.COMPLETED,
		})).toEqual({label: 'Recall from memory', action: 'remediation', disabled: true});
	});
});
