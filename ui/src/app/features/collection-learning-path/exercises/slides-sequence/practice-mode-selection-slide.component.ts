import { ChangeDetectionStrategy, Component, EventEmitter, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type {
  SlideContentComponent,
  SlideContentContext,
  SlideContentEvent,
  SlideExerciseRuntimeState,
} from '../../../../shared/slide-exercise';

type PracticeMode = 'vocabulary-dictation' | 'sentence-completion' | 'sentence-shadowing';

interface PracticeModeOption {
  readonly id: PracticeMode;
  readonly label: string;
  readonly description: string;
}

interface PracticeModeSelectionData {
  readonly instruction: string;
  readonly question: string;
  readonly options: readonly PracticeModeOption[];
}

const PRACTICE_MODES = new Set<PracticeMode>([
  'vocabulary-dictation',
  'sentence-completion',
  'sentence-shadowing',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error('Practice mode selection configuration is unavailable.');
  return text;
}

function parseData(value: unknown): PracticeModeSelectionData {
  const source = record(value);
  const options = Array.isArray(source?.['options'])
    ? source['options'].map((value) => {
        const option = record(value);
        const id = requiredText(option?.['id']) as PracticeMode;
        if (!PRACTICE_MODES.has(id)) {
          throw new Error('Practice mode selection configuration is unavailable.');
        }
        return {
          id,
          label: requiredText(option?.['label']),
          description: requiredText(option?.['description']),
        };
      })
    : [];
  if (options.length !== PRACTICE_MODES.size || new Set(options.map((option) => option.id)).size !== PRACTICE_MODES.size) {
    throw new Error('Practice mode selection configuration is unavailable.');
  }
  return {
    instruction: requiredText(source?.['instruction']),
    question: requiredText(source?.['question']),
    options,
  };
}

@Component({
  selector: 'app-practice-mode-selection-slide',
  standalone: true,
  imports: [MatButtonModule],
  template: `
    <article class="slide-type" data-testid="practice-mode-selection-slide">
      <section class="slide-interaction">
        <p class="slide-instruction">{{ data().instruction }}</p>
        <h1>{{ data().question }}</h1>
        <div class="choice-grid" role="radiogroup" aria-label="Practice modes">
          @for (option of data().options; track option.id; let index = $index) {
            <button
              mat-stroked-button
              type="button"
              class="choice-option"
              data-testid="practice-mode-option"
              role="radio"
              [attr.data-state]="selectedMode() === option.id ? 'selected' : 'neutral'"
              [attr.aria-checked]="selectedMode() === option.id"
              [attr.aria-label]="(index + 1) + '. ' + option.label + '. ' + option.description"
              (click)="select(option.id)"
            >
              <span class="choice-option__content">
                <span class="choice-option__number" aria-hidden="true">{{ index + 1 }}</span>
                <span class="d-grid gap-1">
                  <strong>{{ option.label }}</strong>
                  <span>{{ option.description }}</span>
                </span>
              </span>
            </button>
          }
        </div>
      </section>
    </article>
  `,
  styleUrl: '../../../../shared/slide-exercise/library/slide-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeModeSelectionSlideComponent implements SlideContentComponent {
  readonly stateChange = new EventEmitter<SlideExerciseRuntimeState>();
  readonly event = new EventEmitter<SlideContentEvent>();
  readonly data = signal<PracticeModeSelectionData>({ instruction: '', question: '', options: [] });
  readonly selectedMode = signal<PracticeMode | null>(null);
  private context: SlideContentContext | null = null;

  load(context: SlideContentContext): void {
    this.context = context;
    this.data.set(parseData(context.data));
    this.selectedMode.set(null);
    this.stateChange.emit({ chrome: { footer: { primary: { disabled: true } } } });
  }

  handleShortcut(key: string): void {
    const option = this.data().options[Number(key) - 1];
    if (option) this.select(option.id);
  }

  select(mode: PracticeMode): void {
    if (!this.data().options.some((option) => option.id === mode)) return;
    this.selectedMode.set(mode);
    this.stateChange.emit({ chrome: { footer: { primary: { disabled: false } } } });
  }

  handleAction(actionId: string): void {
    const practiceMode = this.selectedMode();
    if (actionId !== 'continue' || !practiceMode || !this.context?.deck) return;
    this.event.emit({ type: 'selected', data: { practiceMode } });
    this.context.deck.next();
  }
}
