import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
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

function setup() {
  const speech = { speak: vi.fn().mockReturnValue(true), cancel: vi.fn() };
  const store = { state: signal({ settings: { voiceRate: 0.92 } }) };
  TestBed.configureTestingModule({
    imports: [MultipleChoiceSlideContentComponent],
    providers: [
      { provide: SpeechService, useValue: speech },
      { provide: LearningStoreService, useValue: store },
    ],
  });
  const fixture = TestBed.createComponent(MultipleChoiceSlideContentComponent);
  return { fixture, component: fixture.componentInstance, speech };
}

describe('MultipleChoiceSlideContentComponent', () => {
  it('enables Check after a selection and emits a correct answer before Continue', () => {
    const { component } = setup();
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
    const { component } = setup();
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

  it('uses the shared sentence-practice speech path for autoplay and replay', () => {
    const { fixture, component, speech } = setup();

    component.load({ slideId: 'word-1', type: 'multiple-choice', data });
    fixture.detectChanges();

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenLastCalledWith('persistent', 0.92);

    const replay = fixture.nativeElement.querySelector<HTMLButtonElement>('[aria-label="Play pronunciation for persistent"]');
    expect(replay).not.toBeNull();
    expect(replay?.classList.contains('mat-mdc-icon-button')).toBe(true);
    replay?.click();

    expect(speech.speak).toHaveBeenCalledTimes(2);
    expect(speech.speak).toHaveBeenLastCalledWith('persistent', 0.92);
  });
});
