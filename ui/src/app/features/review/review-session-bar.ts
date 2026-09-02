export interface ReviewSessionBarInput {
	accuracy: number | null;
	answered: number;
	initialCount: number;
	freePractice: boolean;
	recheck: boolean;
}

export interface ReviewSessionBarState {
	accuracyLabel: string;
	counterLabel: string;
	recheck: boolean;
	accessibleLabel: string;
}

export function buildReviewSessionBarState(input: ReviewSessionBarInput): ReviewSessionBarState {
	const answered = Math.max(0, Math.trunc(input.answered));
	const initialCount = Math.max(0, Math.trunc(input.initialCount));
	const accuracyLabel = input.accuracy === null ? '—' : `${Math.max(0, Math.min(100, Math.round(input.accuracy)))}%`;
	const counterLabel = input.freePractice
		? `${answered} ${answered === 1 ? 'answer' : 'answers'}`
		: `${input.recheck ? Math.min(answered, initialCount) : Math.min(answered + 1, initialCount)} / ${initialCount}`;
	const parts = [`Accuracy: ${accuracyLabel}`];
	if (input.recheck) parts.push('Recheck');
	parts.push(counterLabel);
	return {
		accuracyLabel,
		counterLabel,
		recheck: input.recheck,
		accessibleLabel: parts.join(' · '),
	};
}
