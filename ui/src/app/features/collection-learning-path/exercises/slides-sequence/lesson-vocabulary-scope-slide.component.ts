import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { parseSlideSequenceVocabularyPayload, type SlideSequenceVocabularyItem } from '../../../../domain/collection-learning-path/slide-sequence-vocabulary-scope';
import type { ChoiceSlideData, DictationSlideData } from '../../../../shared/slide-exercise';
import type { SlideContentComponent, SlideContentContext, SlideExerciseSlide } from '../../../../shared/slide-exercise';
import type { ExerciseContext } from '../exercise-runtime/exercise-contracts';

export interface GeneratedVocabularyDictationConfig {
  readonly type: 'dictation';
  readonly instruction: string;
  readonly mode: 'word' | 'phrase' | 'sentence';
  readonly speech: { readonly autoplay: boolean; readonly replay: boolean };
  readonly caseSensitive: boolean;
  readonly punctuationSensitive: boolean;
}

export interface GeneratedVocabularyMeaningChoiceConfig {
  readonly type: 'meaning-choice';
  readonly instruction: string;
  readonly mode: 'meaning';
  readonly optionCount: number;
  readonly explanationTemplate: string;
}

export type GeneratedVocabularySlideConfig =
  | GeneratedVocabularyDictationConfig
  | GeneratedVocabularyMeaningChoiceConfig;

interface LessonVocabularyScopeData {
  readonly intro: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
  };
  readonly generatedSlide: GeneratedVocabularySlideConfig;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(source: Record<string, unknown> | null, key: string): string {
  const value = String(source?.[key] ?? '').trim();
  if (!value) throw new Error('Lesson vocabulary slide configuration is unavailable.');
  return value;
}

function requiredBoolean(source: Record<string, unknown> | null, key: string): boolean {
  if (typeof source?.[key] !== 'boolean') {
    throw new Error('Lesson vocabulary slide configuration is unavailable.');
  }
  return source[key];
}

function parseScopeData(value: unknown): LessonVocabularyScopeData {
  const source = record(value);
  const intro = record(source?.['intro']);
  const generated = record(source?.['generatedSlide']);
  const type = requiredText(generated, 'type');
  const base = {
    instruction: requiredText(generated, 'instruction'),
  };
  let generatedSlide: GeneratedVocabularySlideConfig;
  if (type === 'dictation') {
    const mode = requiredText(generated, 'mode');
    if (mode !== 'word' && mode !== 'phrase' && mode !== 'sentence') {
      throw new Error('Lesson vocabulary slide configuration is unavailable.');
    }
    const speech = record(generated?.['speech']);
    generatedSlide = {
      type,
      ...base,
      mode,
      speech: {
        autoplay: requiredBoolean(speech, 'autoplay'),
        replay: requiredBoolean(speech, 'replay'),
      },
      caseSensitive: requiredBoolean(generated, 'caseSensitive'),
      punctuationSensitive: requiredBoolean(generated, 'punctuationSensitive'),
    };
  } else if (type === 'meaning-choice') {
    const optionCount = Number(generated?.['optionCount']);
    if (requiredText(generated, 'mode') !== 'meaning' || !Number.isSafeInteger(optionCount) || optionCount < 2) {
      throw new Error('Lesson vocabulary slide configuration is unavailable.');
    }
    generatedSlide = {
      type,
      ...base,
      mode: 'meaning',
      optionCount,
      explanationTemplate: requiredText(generated, 'explanationTemplate'),
    };
  } else {
    throw new Error('Lesson vocabulary generated slide is unavailable.');
  }
  return {
    intro: {
      eyebrow: requiredText(intro, 'eyebrow'),
      title: requiredText(intro, 'title'),
      description: requiredText(intro, 'description'),
    },
    generatedSlide,
  };
}

function renderTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{\{([a-zA-Z]+)\}\}/gu, (_match, token: string) => {
    if (!(token in values)) throw new Error(`Unsupported lesson vocabulary template token: ${token}`);
    return String(values[token]);
  });
}

function shuffledOptions(items: readonly SlideSequenceVocabularyItem[], index: number, optionCount: number) {
  const selected = Array.from({ length: optionCount }, (_, offset) => items[(index + offset) % items.length]);
  const shift = index % selected.length;
  return [...selected.slice(shift), ...selected.slice(0, shift)].map((item) => ({ id: item.id, label: item.term }));
}

export function buildLessonVocabularySlides(
  scopeSlideId: string,
  config: GeneratedVocabularySlideConfig,
  items: readonly SlideSequenceVocabularyItem[],
): readonly SlideExerciseSlide[] {
  if (config.type === 'meaning-choice' && items.length < config.optionCount) {
    throw new Error(`Meaning review requires at least ${config.optionCount} vocabulary items.`);
  }
  return items.map((item, index) => config.type === 'dictation'
    ? ({
        id: `${scopeSlideId}-${item.id}`,
        rootSlideId: `${scopeSlideId}-${item.id}`,
        itemId: item.id,
        type: 'dictation',
        data: {
          mode: config.mode,
          instruction: config.instruction,
          speech: { text: item.term, ...config.speech },
          answer: item.term,
          caseSensitive: config.caseSensitive,
          punctuationSensitive: config.punctuationSensitive,
        } satisfies DictationSlideData,
      })
    : ({
        id: `${scopeSlideId}-${item.id}`,
        rootSlideId: `${scopeSlideId}-${item.id}`,
        itemId: item.id,
        type: 'choice',
        data: {
          mode: config.mode,
          instruction: config.instruction,
          question: item.definitions[0],
          options: shuffledOptions(items, index, config.optionCount),
          correctOptionIds: [item.id],
          explanation: renderTemplate(config.explanationTemplate, {
            term: item.term,
            definition: item.definitions[0],
          }),
        } satisfies ChoiceSlideData,
      }));
}

@Component({
  selector: 'app-lesson-vocabulary-scope-slide',
  standalone: true,
  template: `
    <section class="d-grid gap-3" data-testid="lesson-vocabulary-scope-slide">
      <p class="mb-0">{{ eyebrow() }}</p>
      <h1 class="mb-0">{{ title() }}</h1>
      <p class="mb-0">{{ description() }}</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonVocabularyScopeSlideComponent implements SlideContentComponent {
  private context: SlideContentContext | null = null;
  private generatedSlide: GeneratedVocabularySlideConfig | null = null;
  private items: readonly SlideSequenceVocabularyItem[] = [];
  readonly eyebrow = signal('');
  readonly title = signal('');
  readonly description = signal('');

  load(context: SlideContentContext): void {
    if (!context.deck) throw new Error('Slide deck controller is unavailable.');
    const environment = record(context.environment) as unknown as ExerciseContext | null;
    const payload = parseSlideSequenceVocabularyPayload(environment?.payload);
    const data = parseScopeData(context.data);
    this.context = context;
    this.generatedSlide = data.generatedSlide;
    this.items = payload.items;
    this.eyebrow.set(data.intro.eyebrow);
    this.title.set(renderTemplate(data.intro.title, { total: payload.items.length }));
    this.description.set(data.intro.description);
  }

  handleAction(actionId: string): void {
    const context = this.context;
    if (actionId !== 'start-vocabulary-scope' || !context?.deck || !this.generatedSlide) return;
    context.deck.insertSlides({
      anchorId: context.slideId,
      gap: 0,
      slides: buildLessonVocabularySlides(context.slideId, this.generatedSlide, this.items),
    });
    context.deck.next();
  }
}
