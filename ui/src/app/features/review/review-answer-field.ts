import {RemediationPhase} from '../../domain/remediation/remediation';

export type ReviewAnswerFieldAction = 'review' | 'remediation';
export type ReviewAnswerFieldFeedbackTone = 'correct' | 'incorrect' | null;

export interface ReviewAnswerFieldState {
	label: 'Your answer' | 'Recall from memory' | 'Exact copy';
	action: ReviewAnswerFieldAction;
	readOnly: boolean;
	feedbackTone: ReviewAnswerFieldFeedbackTone;
}

export interface ReviewAnswerFieldContext {
	active: boolean;
	currentTask: 'review' | 'recheck';
	feedbackCorrect: boolean | null;
	remediationPhase: RemediationPhase | null;
}

export function buildReviewAnswerFieldState(context: ReviewAnswerFieldContext): ReviewAnswerFieldState | null {
	if (!context.active) return null;
	if (context.remediationPhase === RemediationPhase.CORRECTION) return null;

	if (context.remediationPhase) {
		const completed = context.remediationPhase === RemediationPhase.COMPLETED;
		return {
			label: context.remediationPhase === RemediationPhase.COPY ? 'Exact copy' : 'Recall from memory',
			action: 'remediation',
			readOnly: completed,
			feedbackTone: completed ? 'correct' : null,
		};
	}

	if (context.currentTask !== 'review') return null;
	return {
		label: 'Your answer',
		action: 'review',
		readOnly: context.feedbackCorrect !== null,
		feedbackTone: context.feedbackCorrect === null ? null : context.feedbackCorrect ? 'correct' : 'incorrect',
	};
}
