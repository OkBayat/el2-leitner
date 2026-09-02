import {describe, expect, it} from 'vitest';
import {buildReviewSessionBarState} from './review-session-bar';

describe('buildReviewSessionBarState', () => {
	it('shows the next card position for scheduled review', () => {
		expect(buildReviewSessionBarState({
			accuracy: 69,
			answered: 120,
			initialCount: 411,
			freePractice: false,
			recheck: false,
		})).toEqual({
			accuracyLabel: '69%',
			counterLabel: '121 / 411',
			recheck: false,
			accessibleLabel: 'Accuracy: 69% · 121 / 411',
		});
	});

	it('keeps the completed primary-card count visible during a scheduled recheck', () => {
		expect(buildReviewSessionBarState({
			accuracy: 69,
			answered: 120,
			initialCount: 411,
			freePractice: false,
			recheck: true,
		})).toEqual({
			accuracyLabel: '69%',
			counterLabel: '120 / 411',
			recheck: true,
			accessibleLabel: 'Accuracy: 69% · Recheck · 120 / 411',
		});
	});

	it('shows an answer count instead of a finite denominator in House 1 free practice', () => {
		expect(buildReviewSessionBarState({
			accuracy: 69,
			answered: 120,
			initialCount: 411,
			freePractice: true,
			recheck: false,
		})).toEqual({
			accuracyLabel: '69%',
			counterLabel: '120 answers',
			recheck: false,
			accessibleLabel: 'Accuracy: 69% · 120 answers',
		});
	});

	it('does not count a House 1 recheck as another answer', () => {
		expect(buildReviewSessionBarState({
			accuracy: 69,
			answered: 120,
			initialCount: 411,
			freePractice: true,
			recheck: true,
		})).toEqual({
			accuracyLabel: '69%',
			counterLabel: '120 answers',
			recheck: true,
			accessibleLabel: 'Accuracy: 69% · Recheck · 120 answers',
		});
	});

	it('uses an em dash and zero answers before the first free-practice answer', () => {
		expect(buildReviewSessionBarState({
			accuracy: null,
			answered: 0,
			initialCount: 411,
			freePractice: true,
			recheck: false,
		})).toEqual({
			accuracyLabel: '—',
			counterLabel: '0 answers',
			recheck: false,
			accessibleLabel: 'Accuracy: — · 0 answers',
		});
	});
});
