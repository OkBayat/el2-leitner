import { describe, expect, it } from 'vitest';
import { buildLeitnerVocabularySlides } from './leitner-house-one-scope-slide';

describe('Leitner House 1 scope slide', () => {
  it('builds only reusable dictation slides from the selected server snapshot', () => {
    const slides = buildLeitnerVocabularySlides(
      'scope-slide',
      { type: 'dictation' },
      [
        { id: 'course-a', term: 'alpha', accepted: ['alpha'] },
        { id: 'other', term: 'beta', accepted: ['beta', 'Beta'] },
      ],
    );

    expect(slides.map((slide) => slide.type)).toEqual(['dictation', 'dictation']);
    expect(slides.map((slide) => slide.id)).toEqual(['scope-slide-course-a', 'scope-slide-other']);
    expect(slides[1].data).toEqual(expect.objectContaining({
      answer: 'beta',
      acceptedAnswers: ['beta', 'Beta'],
      speech: { text: 'beta', autoplay: true, replay: true },
    }));
  });

  it('rejects an unavailable generated slide type instead of silently substituting it', () => {
    expect(() => buildLeitnerVocabularySlides('scope', { type: 'unknown' }, [])).toThrow(/generated slide type/iu);
  });
});
