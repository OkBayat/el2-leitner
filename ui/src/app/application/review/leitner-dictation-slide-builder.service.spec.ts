import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDictationSlideBuilderService } from './leitner-dictation-slide-builder.service';

describe('LeitnerDictationSlideBuilderService', () => {
	afterEach(() => vi.restoreAllMocks());

	it('shuffles the complete requested scope into reusable spelling slides', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const builder = TestBed.inject(LeitnerDictationSlideBuilderService);
		const slides = builder.build('daily-review', [
			{ id: 'word-1', term: 'make progress', accepted: ['make progress'] },
			{ id: 'word-2', term: 'persistent', accepted: ['persistent', 'Persistent'] },
		], new Map([['word-1', 'move towards a goal']]));

		expect(slides.map((slide) => slide.itemId)).toEqual(['word-2', 'word-1']);
		expect(slides).toHaveLength(2);
		expect(slides[0].data).toMatchObject({ definition: '' });
		expect(slides[1]).toMatchObject({
			id: 'daily-review-vocabulary-dictation-word-1',
			rootSlideId: 'daily-review-vocabulary-dictation-word-1',
			itemId: 'word-1',
			type: 'dictation',
			data: {
				mode: 'phrase',
				instruction: 'Listen and type the word or collocation.',
				answer: 'make progress',
				definition: 'move towards a goal',
				acceptedAnswers: ['make progress'],
				speech: { text: 'make progress', autoplay: true, replay: true },
				caseSensitive: false,
				punctuationSensitive: false,
			},
		});
	});
});
