import { describe, expect, it } from 'vitest';
import { parseSlideBaseExerciseSlides } from './slide-base-exercise';

describe('slide-base exercise definition', () => {
  it('parses one ordered reusable-slide array', () => {
    const slides = parseSlideBaseExerciseSlides({
      slides: [
        { id: 'scope', type: 'leitner-house-one-scope', data: { generatedSlide: { type: 'dictation' } } },
        { id: 'summary', type: 'summary', terminal: true, data: { aggregationMode: 'first-attempts' } },
      ],
    });

    expect(slides.map((slide) => slide.type)).toEqual(['leitner-house-one-scope', 'summary']);
    expect(slides[1].terminal).toBe(true);
  });

  it('rejects definitions without exactly one terminal last slide', () => {
    expect(() => parseSlideBaseExerciseSlides({ slides: [{ id: 'scope', type: 'message' }] })).toThrow(/terminal/iu);
    expect(() => parseSlideBaseExerciseSlides({
      slides: [
        { id: 'summary', type: 'summary', terminal: true },
        { id: 'scope', type: 'message' },
      ],
    })).toThrow(/terminal/iu);
  });
});
