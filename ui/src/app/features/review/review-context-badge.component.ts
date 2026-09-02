import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {ReviewSessionService} from '../../application/review/review-session.service';
import {RemediationContext, RemediationPhase, RemediationSnapshot} from '../../domain/remediation/remediation';

export type ReviewContextBadgeKind = 'spelling-correction' | 'recall-from-memory' | 'mistake-recheck' | 'copy-correction';
export type ReviewContextBadgeIcon = 'mistake' | 'memory' | 'recheck' | 'copy';

export interface ReviewContextBadgeState {
	kind: ReviewContextBadgeKind;
	icon: ReviewContextBadgeIcon;
	label: string;
}

type RemediationContextSnapshot = Pick<RemediationSnapshot, 'phase' | 'context'>;

const SPELLING_CORRECTION: ReviewContextBadgeState = {
	kind: 'spelling-correction',
	icon: 'mistake',
	label: 'SPELLING CORRECTION',
};
const RECALL_FROM_MEMORY: ReviewContextBadgeState = {
	kind: 'recall-from-memory',
	icon: 'memory',
	label: 'RECALL FROM MEMORY',
};
const MISTAKE_RECHECK: ReviewContextBadgeState = {
	kind: 'mistake-recheck',
	icon: 'recheck',
	label: 'MISTAKE RECHECK',
};
const COPY_THE_CORRECTION: ReviewContextBadgeState = {
	kind: 'copy-correction',
	icon: 'copy',
	label: 'COPY THE CORRECTION',
};

export function resolveReviewContextBadge(remediation: RemediationContextSnapshot | null): ReviewContextBadgeState | null {
	if (!remediation) return null;

	if (remediation.phase === RemediationPhase.COPY) return COPY_THE_CORRECTION;

	// A completed recheck stays visibly identified until Continue is pressed.
	if (remediation.context === RemediationContext.RECHECK) return MISTAKE_RECHECK;

	if (remediation.phase === RemediationPhase.CORRECTION) return SPELLING_CORRECTION;

	// Successful immediate recall keeps its context marker during the success state.
	if (remediation.phase === RemediationPhase.RECALL || remediation.phase === RemediationPhase.COMPLETED) {
		return RECALL_FROM_MEMORY;
	}

	return null;
}

@Component({
	selector: 'app-review-context-badge',
	templateUrl: 'review-context-badge.component.html',
	styleUrl: 'review-context-badge.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewContextBadgeComponent {
	private readonly session = inject(ReviewSessionService);
	readonly badge = computed(() => resolveReviewContextBadge(this.session.remediation()));
}
