import { describe, expect, it } from 'vitest';
import { parseSlideSequenceExerciseSlides } from './slide-sequence-exercise';

describe('slide sequence exercise definition', () => {
  it('parses one ordered mixed-slide deck', () => {
    const slides = parseSlideSequenceExerciseSlides({
      slides: [
        { id: 'tip', type: 'teaching-card', data: { title: 'Notice', blocks: [] } },
        { id: 'practice', type: 'choice', data: { question: 'Choose.' } },
        { id: 'summary', type: 'summary', terminal: true },
      ],
    });

    expect(slides.map((slide) => slide.type)).toEqual([
      'teaching-card',
      'choice',
      'summary',
    ]);
  });

  it('rejects malformed, duplicate, and non-terminal decks', () => {
    expect(() => parseSlideSequenceExerciseSlides({ slides: [] })).toThrow(/slides/iu);
    expect(() => parseSlideSequenceExerciseSlides({
      slides: [
        { id: 'same', type: 'choice' },
        { id: 'same', type: 'summary', terminal: true },
      ],
    })).toThrow(/unique/iu);
    expect(() => parseSlideSequenceExerciseSlides({
      slides: [{ id: 'practice', type: 'choice' }],
    })).toThrow(/terminal/iu);
  });
});
