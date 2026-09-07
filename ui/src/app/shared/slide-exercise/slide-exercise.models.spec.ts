import { describe, expect, it } from 'vitest';
import {
  resolveSlideExerciseActionState,
  resolveSlideExercisePresentation,
  validateSlideExerciseSlides,
  type SlideExerciseChromeConfig,
  type SlideExerciseSlide,
} from './slide-exercise.models';

function slide(id: string, type = 'message', chrome?: SlideExerciseChromeConfig): SlideExerciseSlide {
  return { id, type, data: {}, chrome };
}

describe('slide exercise model', () => {
  it('keeps one ordered slide array without before, practice, summary, or after phases', () => {
    const slides = validateSlideExerciseSlides([
      slide('intro', 'message'),
      slide('choice', 'choice'),
      slide('spelling', 'text-input'),
      slide('result', 'summary'),
      slide('reflection', 'message'),
    ]);

    expect(slides.map((item) => item.id)).toEqual(['intro', 'choice', 'spelling', 'result', 'reflection']);
  });

  it('requires at least one slide and stable unique slide ids and types', () => {
    expect(() => validateSlideExerciseSlides([])).toThrow('Slide exercise requires at least one slide.');
    expect(() => validateSlideExerciseSlides([slide('same'), slide('same')])).toThrow('Slide ids must be unique.');
    expect(() => validateSlideExerciseSlides([slide('  ')])).toThrow('Slide ids are required.');
    expect(() => validateSlideExerciseSlides([slide('valid', '  ')])).toThrow('Slide types are required.');
  });

  it('shows progress and a Continue action by default', () => {
    const current = slide('two');
    const presentation = resolveSlideExercisePresentation({ slide: current, index: 1, total: 4 });

    expect(presentation.header).toEqual({
      visible: true,
      progress: { value: 50, label: '2 of 4' },
    });
    expect(presentation.footer.primary).toMatchObject({
      id: 'continue',
      label: 'Continue',
      tone: 'primary',
      behavior: 'next',
      disabled: false,
      loading: false,
    });
    expect(presentation.footer.secondary).toBeNull();
  });

  it('lets a renderer define type defaults while the slide keeps the final override', () => {
    const rendererDefaults: SlideExerciseChromeConfig = {
      footer: {
        primary: { id: 'check', label: 'Check', behavior: 'content' },
      },
    };
    const current = slide('question', 'choice', {
      footer: { primary: { label: 'Check answer' } },
    });

    const presentation = resolveSlideExercisePresentation({
      slide: current,
      index: 0,
      total: 1,
      rendererDefaults,
    });

    expect(presentation.footer.primary).toMatchObject({
      id: 'check',
      label: 'Check answer',
      behavior: 'content',
    });
  });

  it('supports per-slide header and action overrides without changing the global defaults', () => {
    const current = slide('instruction', 'message', {
      header: { visible: false },
      footer: {
        primary: { id: 'understood', label: 'I got it', behavior: 'next' },
        secondary: { id: 'skip', label: 'Skip', behavior: 'next' },
      },
    });

    const presentation = resolveSlideExercisePresentation({ slide: current, index: 0, total: 3 });

    expect(presentation.header.visible).toBe(false);
    expect(presentation.footer.primary).toMatchObject({ id: 'understood', label: 'I got it' });
    expect(presentation.footer.secondary).toMatchObject({ id: 'skip', label: 'Skip', tone: 'secondary' });
  });

  it('lets runtime slide content drive feedback and disabled/loading actions after render', () => {
    const presentation = resolveSlideExercisePresentation({
      slide: slide('answer', 'choice'),
      index: 0,
      total: 1,
      runtime: {
        chrome: {
          footer: {
            tone: 'success',
            title: 'Correct!',
            detail: 'Nice work.',
            primary: { label: 'Continue', disabled: true, loading: true },
          },
        },
      },
    });

    expect(presentation.footer).toMatchObject({ tone: 'success', title: 'Correct!', detail: 'Nice work.' });
    expect(presentation.footer.primary).toMatchObject({ disabled: true, loading: true });
    expect(resolveSlideExerciseActionState('success', true, false)).toBe('disabled');
    expect(resolveSlideExerciseActionState('warning', false, true)).toBe('disabled');
  });
});
