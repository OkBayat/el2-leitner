import {describe, expect, it} from 'vitest';
import {reviewAnswerSoundPath} from './review-answer-sound.service';

describe('review answer sound paths', () => {
	it('maps correct answers to the success sound asset', () => {
		expect(reviewAnswerSoundPath('correct')).toBe('/assets/correct-answer-song.mp3');
	});

	it('maps incorrect answers to the error sound asset', () => {
		expect(reviewAnswerSoundPath('incorrect')).toBe('/assets/wrong-answer-song.mp3');
	});
});
