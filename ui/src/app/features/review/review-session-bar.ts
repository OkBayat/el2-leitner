export interface ReviewSessionBarInput {
	answered: number;
	initialCount: number;
	freePractice: boolean;
	recheck: boolean;
}

export interface ReviewSessionBarState {
	counterLabel: string | null;
	recheck: boolean;
}

export function buildReviewSessionBarState(input: ReviewSessionBarInput): ReviewSessionBarState {
	if (input.recheck) {
		return {counterLabel: null, recheck: true};
	}

	const answered = Math.max(0, Math.trunc(input.answered));
	const initialCount = Math.max(0, Math.trunc(input.initialCount));
	return {
		counterLabel: input.freePractice
			? `${answered} ${answered === 1 ? 'answer' : 'answers'}`
			: `${Math.min(answered + 1, initialCount)} / ${initialCount}`,
		recheck: false,
	};
}
