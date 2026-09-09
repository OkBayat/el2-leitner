import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { SlideContentContext } from '../../../../shared/slide-exercise';
import { PracticeModeSelectionSlideComponent } from './practice-mode-selection-slide.component';

const context = (next = vi.fn()): SlideContentContext => ({
  slideId: 'practice-mode',
  type: 'practice-mode-selection',
  data: {
    instruction: 'Choose how you want to practice.',
    question: 'Select a practice mode',
    options: [
      { id: 'vocabulary-dictation', label: 'Vocabulary Dictation', description: 'Hear a word or collocation and type it.' },
      { id: 'sentence-completion', label: 'Sentence Completion', description: 'Hear the missing word or collocation and complete the sentence.' },
      { id: 'sentence-shadowing', label: 'Sentence Shadowing', description: 'Hear a complete sentence and repeat it.' },
    ],
  },
  deck: { insertSlides: vi.fn(), next, results: () => [] },
});

describe('PracticeModeSelectionSlideComponent', () => {
  it('requires one of the three configured modes before continuing', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PracticeModeSelectionSlideComponent],
    }).createComponent(PracticeModeSelectionSlideComponent);
    const states = vi.fn();
    const events = vi.fn();
    fixture.componentInstance.stateChange.subscribe(states);
    fixture.componentInstance.event.subscribe(events);
    const next = vi.fn();

    fixture.componentInstance.load(context(next));
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const options = host.querySelectorAll<HTMLButtonElement>('[data-testid="practice-mode-option"]');
    expect(options).toHaveLength(3);
    expect([...options].map((option) => option.getAttribute('aria-label'))).toEqual([
      '1. Vocabulary Dictation. Hear a word or collocation and type it.',
      '2. Sentence Completion. Hear the missing word or collocation and complete the sentence.',
      '3. Sentence Shadowing. Hear a complete sentence and repeat it.',
    ]);
    expect(states).toHaveBeenLastCalledWith({ chrome: { footer: { primary: { disabled: true } } } });

    options[1].click();
    fixture.detectChanges();

    expect(options[1].getAttribute('aria-checked')).toBe('true');
    expect(states).toHaveBeenLastCalledWith({ chrome: { footer: { primary: { disabled: false } } } });
    fixture.componentInstance.handleAction('continue');
    expect(events).toHaveBeenCalledWith({ type: 'selected', data: { practiceMode: 'sentence-completion' } });
    expect(next).toHaveBeenCalledOnce();
  });
});
