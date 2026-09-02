import {describe, expect, it} from 'vitest';
import {RemediationPhase} from '../../domain/remediation/remediation';
import {buildReviewAnswerFieldState} from './review-answer-field';

describe('review answer field state', () => {
	it('does not render outside an active session', () => {
		expect(buildReviewAnswerFieldState({
			active: false,
			currentTask: 'review',
			feedbackCorrect: null,
			remediationPhase: null,
		})).toBeNull();
	});

	it('does not render the answer input on the spelling-correction screen', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: false,
			remediationPhase: RemediationPhase.CORRECTION,
		})).toBeNull();
	});

	it('keeps the normal review answer editable until feedback arrives', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: null,
			remediationPhase: null,
		})).toEqual({label: 'Your answer', action: 'review', readOnly: false, feedbackTone: null});
	});

	it('locks correct feedback as readonly and green without defining an incorrect color state', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: true,
			remediationPhase: null,
		})).toEqual({label: 'Your answer', action: 'review', readOnly: true, feedbackTone: 'correct'});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: false,
			remediationPhase: null,
		})).toEqual({label: 'Your answer', action: 'review', readOnly: true, feedbackTone: null});
	});

	it('uses the same editable field for recall and copy, then keeps successful recall readonly', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: false,
			remediationPhase: RemediationPhase.RECALL,
		})).toEqual({label: 'Recall from memory', action: 'remediation', readOnly: false, feedbackTone: null});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: false,
			remediationPhase: RemediationPhase.COPY,
		})).toEqual({label: 'Exact copy', action: 'remediation', readOnly: false, feedbackTone: null});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'review',
			feedbackCorrect: false,
			remediationPhase: RemediationPhase.COMPLETED,
		})).toEqual({label: 'Recall from memory', action: 'remediation', readOnly: true, feedbackTone: 'correct'});
	});

	it('keeps the same recall field through a scheduled recheck and locks the submitted answer on success', () => {
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'recheck',
			feedbackCorrect: null,
			remediationPhase: RemediationPhase.RECALL,
		})).toEqual({label: 'Recall from memory', action: 'remediation', readOnly: false, feedbackTone: null});
		expect(buildReviewAnswerFieldState({
			active: true,
			currentTask: 'recheck',
			feedbackCorrect: null,
			remediationPhase: RemediationPhase.COMPLETED,
		})).toEqual({label: 'Recall from memory', action: 'remediation', readOnly: true, feedbackTone: 'correct'});
	});
});
