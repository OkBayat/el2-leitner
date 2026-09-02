import {RemediationPhase} from '../../domain/remediation/remediation';

export type ReviewAnswerFieldAction = 'review' | 'remediation';

export interface ReviewAnswerFieldState {
	label: 'Your answer' | 'Recall from memory' | 'Exact copy';
	action: ReviewAnswerFieldAction;
	disabled: boolean;
}

export interface ReviewAnswerFieldContext {
	active: boolean;
	currentTask: 'review' | 'recheck';
	hasFeedback: boolean;
	remediationPhase: RemediationPhase | null;
}

export function buildReviewAnswerFieldState(context: ReviewAnswerFieldContext): ReviewAnswerFieldState | null {
	if (!context.active) return null;
	if (context.remediationPhase === RemediationPhase.CORRECTION) return null;

	if (context.remediationPhase) {
		return {
			label: context.remediationPhase === RemediationPhase.COPY ? 'Exact copy' : 'Recall from memory',
			action: 'remediation',
			disabled: context.remediationPhase === RemediationPhase.COMPLETED,
		};
	}

	if (context.currentTask !== 'review') return null;
	return {
		label: 'Your answer',
		action: 'review',
		disabled: context.hasFeedback,
	};
}
