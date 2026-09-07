import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { SlideContentComponent, SlideContentContext, SlideContentEvent } from '../slide-content-contracts';
import type { SlideExerciseRuntimeState } from '../slide-exercise.models';
import type { MultipleChoiceAnswerEvent, MultipleChoiceSlideData, MultipleChoiceSlideOption } from './multiple-choice-slide-content.models';

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }

function parseData(value: unknown): MultipleChoiceSlideData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid multiple-choice slide data.');
  const source = value as Record<string, unknown>;
  const prompt = text(source['prompt']);
  const correctOptionId = text(source['correctOptionId']);
  const options = Array.isArray(source['options']) ? source['options'].map((raw) => {
    const option = raw as Record<string, unknown>;
    return { id: text(option['id']), label: text(option['label']) } satisfies MultipleChoiceSlideOption;
  }) : [];
  return {
    instruction: text(source['instruction']) || 'Choose one answer.',
    prompt,
    options,
    correctOptionId,
    correctTitle: text(source['correctTitle']) || 'Correct',
    incorrectTitle: text(source['incorrectTitle']) || 'Not quite',
  };
}

@Component({
  selector: 'app-multiple-choice-slide-content',
  standalone: true,
  templateUrl: './multiple-choice-slide-content.component.html',
  styleUrl: './multiple-choice-slide-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultipleChoiceSlideContentComponent implements SlideContentComponent {
  private readonly stateChanges = new Subject<SlideExerciseRuntimeState>();
  private readonly events = new Subject<SlideContentEvent<MultipleChoiceAnswerEvent>>();
  readonly stateChange = this.stateChanges.asObservable();
  readonly event = this.events.asObservable();
  readonly content = signal<MultipleChoiceSlideData>({ prompt: '', options: [], correctOptionId: '' });
  readonly selectedOptionId = signal('');
  readonly checked = signal(false);

  load(context: SlideContentContext): void {
    this.content.set(parseData(context.data));
    this.selectedOptionId.set('');
    this.checked.set(false);
    queueMicrotask(() => this.playPronunciation());
  }

  playPronunciation(): void {
    const word = this.content().prompt;
    if (!word || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(word));
  }

  selectOption(optionId: string): void {
    if (this.checked()) return;
    this.selectedOptionId.set(optionId);
    this.stateChanges.next({ chrome: { footer: { primary: { disabled: false } } } });
  }

  handleAction(actionId: string): void {
    if (actionId !== 'check' || this.checked() || !this.selectedOptionId()) return;
    const correct = this.selectedOptionId() === this.content().correctOptionId;
    this.checked.set(true);
    this.stateChanges.next({ chrome: { footer: { primary: { id: 'continue', label: 'Continue', behavior: 'next', disabled: false }, tone: correct ? 'success' : 'error' } } });
    this.events.next({ type: 'answered', data: { selectedOptionId: this.selectedOptionId(), correctOptionId: this.content().correctOptionId, correct } });
  }

  optionState(optionId: string): 'neutral' | 'selected' | 'correct' | 'incorrect' {
    if (!this.checked()) return this.selectedOptionId() === optionId ? 'selected' : 'neutral';
    if (optionId === this.content().correctOptionId) return 'correct';
    return this.selectedOptionId() === optionId ? 'incorrect' : 'neutral';
  }
}
