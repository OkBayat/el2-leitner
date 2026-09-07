import { describe, expect, it } from 'vitest';
import { parseVocabularyIntakePayload } from '../../../../domain/collection-learning-path/vocabulary-intake';
import type { ChoiceSlideData } from '../../../../shared/slide-exercise';
import {
  buildVocabularyIntakeSlides,
  firstVocabularyIntakePracticeSlideId,
  VOCABULARY_INTAKE_SUMMARY_SLIDE_ID,
  withVocabularyIntakeScore,
} from './vocabulary-intake-slide.factory';

const payload = parseVocabularyIntakePayload({
  scope: { kind: 'collection-section', ref: 'unit-1' },
  items: [
    { id: 'new-1', term: 'persistent', definitions: ['continuing for a long time'], examples: [], progress: { state: 'new', box: 0 } },
    { id: 'box-1', term: 'establish', definitions: ['to create or set up'], examples: [], progress: { state: 'learning', box: 1 } },
    { id: 'box-2', term: 'vary', definitions: ['to be different'], examples: [], progress: { state: 'learning', box: 2 } },
    { id: 'mastered', term: 'mature', definitions: ['fully developed'], examples: [], progress: { state: 'mastered', box: 5 } },
    { id: 'excluded', term: 'omit', definitions: ['to leave out'], examples: [], progress: { state: 'excluded', box: 0 } },
  ],
  summary: { total: 5, newCount: 1, learningCount: 2, masteredCount: 1, excludedCount: 1 },
});

describe('vocabulary intake slide factory', () => {
  it('builds intro, only new/Box 1 questions, and a summary', () => {
    const slides = buildVocabularyIntakeSlides(payload);

    expect(slides.map((slide) => slide.type)).toEqual(['message', 'choice', 'choice', 'summary']);
    expect(slides[0].chrome?.header?.visible).toBe(false);
    expect(slides[0].chrome?.footer?.primary).toMatchObject({ label: "Let's Go", behavior: 'emit' });
    expect(String((slides[0].data as { body: string }).body)).toContain('5 words · 1 mastered · 2 to practice');
    expect(firstVocabularyIntakePracticeSlideId(slides)).toBe('vocabulary-intake-question-new-1');

    const questions = slides.filter((slide) => slide.type === 'choice');
    expect(questions.map((slide) => (slide.data as ChoiceSlideData).question)).toEqual(['persistent', 'establish']);
    for (const slide of questions) {
      const data = slide.data as ChoiceSlideData;
      expect(data.options).toHaveLength(3);
      expect(new Set(data.options.map((option) => option.label)).size).toBe(3);
      expect(data.options.some((option) => data.correctOptionIds.includes(option.id))).toBe(true);
    }
    expect(questions[0].chrome?.header?.progress?.label).toBe('Word 1 of 2');
    expect(questions[1].chrome?.header?.progress?.label).toBe('Word 2 of 2');
  });

  it('updates only the summary slide when answers are recorded', () => {
    const slides = buildVocabularyIntakeSlides(payload);
    const updated = withVocabularyIntakeScore(slides, 1, 1);
    const summary = updated.find((slide) => slide.id === VOCABULARY_INTAKE_SUMMARY_SLIDE_ID)!;
    const metrics = (summary.data as { metrics: Array<{ label: string; value: number }> }).metrics;

    expect(metrics).toEqual([
      { label: 'Correct', value: 1 },
      { label: 'Incorrect', value: 1 },
    ]);
    expect(updated[1]).toBe(slides[1]);
  });
});
