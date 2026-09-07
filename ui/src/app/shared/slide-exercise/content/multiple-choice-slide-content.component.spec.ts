import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { SlideExerciseRuntimeState } from '../slide-exercise.models';
import { MultipleChoiceSlideContentComponent } from './multiple-choice-slide-content.component';

const data = {
  prompt: 'persistent',
  instruction: 'Choose the correct meaning.',
  options: [
    { id: 'a', label: 'continuing for a long time' },
    { id: 'b', label: 'easy to notice' },
    { id: 'c', label: 'likely to change quickly' },
  ],
  correctOptionId: 'a',
};

describe('MultipleChoiceSlideContentComponent', () => {
  it('enables Check after a selection and emits a correct answer before Continue', () => {
    TestBed.configureTestingModule({ imports: [MultipleChoiceSlideContentComponent] });
    const fixture = TestBed.createComponent(MultipleChoiceSlideContentComponent);
    const component = fixture.componentInstance;
    const states: SlideExerciseRuntimeState[] = [];
    const events: unknown[] = [];
    component.stateChange.subscribe((state) => states.push(state));
    component.event.subscribe((event) => events.push(event));
    component.load({ slideId: 'word-1', type: 'multiple-choice', data });

    component.selectOption('a');
    component.handleAction('check');

    expect(states[0]).toEqual({ chrome: { footer: { primary: { disabled: false } } } });
    expect(states[1]).toEqual({
      chrome: {
        footer: {
          tone: 'success',
          title: 'Correct',
          detail: '',
          primary: { id: 'continue', label: 'Continue', behavior: 'next', disabled: false },
        },
      },
    });
    expect(events).toEqual([{ type: 'answered', data: { selectedOptionId: 'a', correctOptionId: 'a', correct: true } }]);
    expect(component.optionState('a')).toBe('correct');
  });

  it('shows the correct answer after an incorrect check', () => {
    TestBed.configureTestingModule({ imports: [MultipleChoiceSlideContentComponent] });
    const component = TestBed.createComponent(MultipleChoiceSlideContentComponent).componentInstance;
    const states: SlideExerciseRuntimeState[] = [];
    component.stateChange.subscribe((state) => states.push(state));
    component.load({ slideId: 'word-1', type: 'multiple-choice', data });

    component.selectOption('b');
    component.handleAction('check');

    expect(states.at(-1)?.chrome?.footer).toMatchObject({
      tone: 'error',
      title: 'Not quite',
      detail: 'Correct answer: continuing for a long time',
    });
    expect(component.optionState('a')).toBe('correct');
    expect(component.optionState('b')).toBe('incorrect');
  });
});
