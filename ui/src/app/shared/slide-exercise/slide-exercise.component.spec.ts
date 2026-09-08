import { SimpleChange } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SlideExerciseComponent } from './slide-exercise.component';
import type { SlideExerciseSlide } from './slide-exercise.models';

function slide(id: string, type = 'message'): SlideExerciseSlide {
  return { id, type, data: {} };
}

describe('SlideExerciseComponent', () => {
  it('preserves the active slide and renderer state when another slide configuration changes', () => {
    const component = new SlideExerciseComponent();
    const initial = [slide('intro'), slide('question', 'choice'), slide('summary', 'summary')];
    component.slides = initial;
    component.ngOnChanges({ slides: new SimpleChange(undefined, initial, true) });
    component.goTo('question');
    component.runtime = { chrome: { footer: { tone: 'success' } } };

    const updated = [initial[0], initial[1], { ...initial[2], data: { score: 1 } }];
    component.slides = updated;
    component.ngOnChanges({ slides: new SimpleChange(initial, updated, false) });

    expect(component.currentSlide?.id).toBe('question');
    expect(component.runtime).toEqual({ chrome: { footer: { tone: 'success' } } });
  });

  it('maps Enter to the current primary action', () => {
    const component = new SlideExerciseComponent();
    const slides: SlideExerciseSlide[] = [{
      id: 'question',
      type: 'message',
      data: {},
      chrome: {
        footer: {
          primary: { id: 'check', label: 'Check', behavior: 'emit' },
        },
      },
    }];
    component.slides = slides;
    component.ngOnChanges({ slides: new SimpleChange(undefined, slides, true) });
    const actions: unknown[] = [];
    component.action.subscribe((action) => actions.push(action));
    const preventDefault = vi.fn();

    component.handleKeyboard({ key: 'Enter', preventDefault } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([{ slideId: 'question', actionId: 'check', behavior: 'emit', slot: 'primary' }]);
  });

  it('lets a slide insert generated slides while keeping terminal slides last', () => {
    const component = new SlideExerciseComponent();
    const initial: SlideExerciseSlide[] = [
      slide('scope', 'leitner-house-one-scope'),
      { ...slide('summary', 'summary'), terminal: true },
    ];
    component.slides = initial;
    component.ngOnChanges({ slides: new SimpleChange(undefined, initial, true) });

    component.insertSlides({
      anchorId: 'scope',
      gap: 0,
      slides: [slide('word-1', 'dictation'), slide('word-2', 'dictation')],
    });

    expect(component.deck.map((item) => item.id)).toEqual(['scope', 'word-1', 'word-2', 'summary']);
    expect(component.currentSlide?.id).toBe('scope');
  });

  it('schedules a retry after a gap and clamps it before the terminal slide', () => {
    const component = new SlideExerciseComponent();
    const initial: SlideExerciseSlide[] = [
      slide('word-1', 'dictation'),
      { ...slide('summary', 'summary'), terminal: true },
    ];
    component.slides = initial;
    component.ngOnChanges({ slides: new SimpleChange(undefined, initial, true) });

    component.insertSlides({
      anchorId: 'word-1',
      gap: 3,
      slides: [{ ...slide('word-1-retry', 'dictation'), rootSlideId: 'word-1', retryNumber: 1 }],
    });

    expect(component.deck.map((item) => item.id)).toEqual(['word-1', 'word-1-retry', 'summary']);
  });

  it('lets a slide copy itself after three intervening slides through the public deck API', () => {
    const component = new SlideExerciseComponent();
    const initial: SlideExerciseSlide[] = [
      slide('word-1', 'dictation'),
      slide('word-2', 'dictation'),
      slide('word-3', 'dictation'),
      slide('word-4', 'dictation'),
      slide('word-5', 'dictation'),
      { ...slide('summary', 'summary'), terminal: true },
    ];
    component.slides = initial;
    component.ngOnChanges({ slides: new SimpleChange(undefined, initial, true) });

    component.deckController.insertSlides({
      anchorId: 'word-1',
      gap: 3,
      slides: [{ ...initial[0], id: 'word-1-retry', rootSlideId: 'word-1', retryNumber: 1 }],
    });

    expect(component.deck.map((item) => item.id)).toEqual([
      'word-1', 'word-2', 'word-3', 'word-4', 'word-1-retry', 'word-5', 'summary',
    ]);
  });
});
