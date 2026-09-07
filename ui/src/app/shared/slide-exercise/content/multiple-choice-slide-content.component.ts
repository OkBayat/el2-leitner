import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { SlideContentComponent, SlideContentContext, SlideContentEvent } from '../slide-content-contracts';
import type { SlideExerciseRuntimeState } from '../slide-exercise.models';
import type {
  MultipleChoiceAnswerEvent,
  MultipleChoiceSlideData,
  MultipleChoiceSlideOption,
} from './multiple-choice-slide-content.models';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseData(value: unknown): MultipleChoiceSlideData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid multiple-choice slide data.');
  const source = value as Record<string, unknown>;
  const prompt = text(source['prompt']);
  const correctOptionId = text(source['correctOptionId']);
  const options = Array.isArray(source['options']) ? source['options'].map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid multiple-choice slide data.');
    const option = raw as Record<string, unknown>;
    const id = text(option['id']);
    const label = text(option['label']);
    if (!id || !label) throw new Error('Invalid multiple-choice slide data.');
    return { id, label } satisfies MultipleChoiceSlideOption;
  }) : [];
  if (!prompt || options.length < 2 || !correctOptionId) throw new Error('Invalid multiple-choice slide data.');
  if (new Set(options.map((option) => option.id)).size !== options.length) throw new Error('Multiple-choice option ids must be unique.');
  if (!options.some((option) => option.id === correctOptionId)) throw new Error('Multiple-choice correct option is unavailable.');
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
  }

  selectOption(optionId: string): void {
    if (this.checked() || !this.content().options.some((option) => option.id === optionId)) return;
    this.selectedOptionId.set(optionId);
    this.stateChanges.next({ chrome: { footer: { primary: { disabled: false } } } });
  }

  handleAction(actionId: string): void {
    const selectedOptionId = this.selectedOptionId();
    if (actionId !== 'check' || this.checked() || !selectedOptionId) return;
    const data = this.content();
    const correct = selectedOptionId === data.correctOptionId;
    const correctLabel = data.options.find((option) => option.id === data.correctOptionId)?.label ?? '';
    this.checked.set(true);
    this.stateChanges.next({
      chrome: {
        footer: {
          tone: correct ? 'success' : 'error',
          title: correct ? data.correctTitle : data.incorrectTitle,
          detail: correct ? '' : `Correct answer: ${correctLabel}`,
          primary: { id: 'continue', label: 'Continue', behavior: 'next', disabled: false },
        },
      },
    });
    this.events.next({
      type: 'answered',
      data: { selectedOptionId, correctOptionId: data.correctOptionId, correct },
    });
  }

  optionState(optionId: string): 'neutral' | 'selected' | 'correct' | 'incorrect' {
    if (!this.checked()) return this.selectedOptionId() === optionId ? 'selected' : 'neutral';
    if (optionId === this.content().correctOptionId) return 'correct';
    return this.selectedOptionId() === optionId ? 'incorrect' : 'neutral';
  }
}
