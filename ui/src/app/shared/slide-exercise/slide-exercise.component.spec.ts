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
});
