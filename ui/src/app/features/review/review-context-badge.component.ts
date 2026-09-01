import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {ReviewSessionService} from '../../application/review/review-session.service';
import {RemediationContext, RemediationPhase, RemediationSnapshot} from '../../domain/remediation/remediation';

export type ReviewContextBadgeKind = 'previous-mistake' | 'recall-from-memory' | 'mistake-recheck' | 'copy-correction';
export type ReviewContextBadgeIcon = 'mistake' | 'memory' | 'recheck' | 'copy';

export interface ReviewContextBadgeState {
	kind: ReviewContextBadgeKind;
	icon: ReviewContextBadgeIcon;
	label: string;
}

type RemediationContextSnapshot = Pick<RemediationSnapshot, 'phase' | 'context'>;

export function resolveReviewContextBadge(remediation: RemediationContextSnapshot | null): ReviewContextBadgeState | null {
	if (!remediation || remediation.phase === RemediationPhase.COMPLETED) return null;

	if (remediation.phase === RemediationPhase.COPY) {
		return {
			kind: 'copy-correction',
			icon: 'copy',
			label: 'COPY THE CORRECTION',
		};
	}

	if (remediation.context === RemediationContext.RECHECK) {
		return {
			kind: 'mistake-recheck',
			icon: 'recheck',
			label: 'MISTAKE RECHECK',
		};
	}

	if (remediation.phase === RemediationPhase.CORRECTION) {
		return {
			kind: 'previous-mistake',
			icon: 'mistake',
			label: 'SPELLING CORRECTION',
		};
	}

	if (remediation.phase === RemediationPhase.RECALL) {
		return {
			kind: 'recall-from-memory',
			icon: 'memory',
			label: 'RECALL FROM MEMORY',
		};
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
