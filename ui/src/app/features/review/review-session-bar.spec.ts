import {describe, expect, it} from 'vitest';
import {buildReviewSessionBarState} from './review-session-bar';

describe('buildReviewSessionBarState', () => {
	it('shows the next card position for scheduled review', () => {
		expect(buildReviewSessionBarState({
			answered: 120,
			initialCount: 411,
			freePractice: false,
			recheck: false,
		})).toEqual({counterLabel: '121 / 411', recheck: false});
	});

	it('hides the scheduled-review count during a recheck', () => {
		expect(buildReviewSessionBarState({
			answered: 120,
			initialCount: 411,
			freePractice: false,
			recheck: true,
		})).toEqual({counterLabel: null, recheck: true});
	});

	it('shows an answer count instead of a finite denominator in House 1 free practice', () => {
		expect(buildReviewSessionBarState({
			answered: 120,
			initialCount: 411,
			freePractice: true,
			recheck: false,
		})).toEqual({counterLabel: '120 answers', recheck: false});
	});

	it('hides the House 1 answer count during a recheck', () => {
		expect(buildReviewSessionBarState({
			answered: 120,
			initialCount: 411,
			freePractice: true,
			recheck: true,
		})).toEqual({counterLabel: null, recheck: true});
	});

	it('uses the singular answer label when exactly one primary answer was submitted', () => {
		expect(buildReviewSessionBarState({
			answered: 1,
			initialCount: 411,
			freePractice: true,
			recheck: false,
		})).toEqual({counterLabel: '1 answer', recheck: false});
	});
});
