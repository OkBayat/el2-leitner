import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { parseSlideSequenceVocabularyPayload, type SlideSequenceVocabularyItem } from '../../../../domain/collection-learning-path/slide-sequence-vocabulary-scope';
import type { ChoiceSlideData, DictationSlideData } from '../../../../shared/slide-exercise';
import type { SlideContentComponent, SlideContentContext, SlideExerciseRuntimeState, SlideExerciseSlide } from '../../../../shared/slide-exercise';
import type { ExerciseContext } from '../exercise-runtime/exercise-contracts';

type GeneratedType = 'dictation' | 'meaning-choice';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function generatedType(value: unknown): GeneratedType {
  const type = String(record(record(value)?.['generatedSlide'])?.['type'] ?? '').trim();
  if (type !== 'dictation' && type !== 'meaning-choice') {
    throw new Error('Lesson vocabulary generated slide is unavailable.');
  }
  return type;
}

function shuffledOptions(items: readonly SlideSequenceVocabularyItem[], index: number) {
  const selected = [items[index], items[(index + 1) % items.length], items[(index + 2) % items.length], items[(index + 3) % items.length]];
  const shift = index % selected.length;
  return [...selected.slice(shift), ...selected.slice(0, shift)].map((item) => ({ id: item.id, label: item.term }));
}

export function buildLessonVocabularySlides(
  scopeSlideId: string,
  type: GeneratedType,
  items: readonly SlideSequenceVocabularyItem[],
): readonly SlideExerciseSlide[] {
  if (type === 'meaning-choice' && items.length < 4) throw new Error('Meaning review requires at least four vocabulary items.');
  return items.map((item, index) => type === 'dictation'
    ? ({
        id: `${scopeSlideId}-${item.id}`,
        rootSlideId: `${scopeSlideId}-${item.id}`,
        itemId: item.id,
        type: 'dictation',
        data: {
          mode: 'word',
          instruction: 'Listen and type the complete Unit 1 word or phrase.',
          speech: { text: item.term, autoplay: true, replay: true },
          answer: item.term,
          caseSensitive: false,
          punctuationSensitive: false,
        } satisfies DictationSlideData,
      })
    : ({
        id: `${scopeSlideId}-${item.id}`,
        rootSlideId: `${scopeSlideId}-${item.id}`,
        itemId: item.id,
        type: 'choice',
        data: {
          mode: 'meaning',
          question: item.definitions[0],
          options: shuffledOptions(items, index),
          correctOptionIds: [item.id],
          explanation: `${item.term}: ${item.definitions[0]}`,
        } satisfies ChoiceSlideData,
      }));
}

@Component({
  selector: 'app-lesson-vocabulary-scope-slide',
  standalone: true,
  template: `
    <section class="d-grid gap-3" data-testid="lesson-vocabulary-scope-slide">
      <p class="mb-0">Complete lesson vocabulary</p>
      <h1 class="mb-0">{{ total() }} Unit 1 targets</h1>
      <p class="mb-0">Every source word and phrase will be tested in this exercise.</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonVocabularyScopeSlideComponent implements SlideContentComponent, OnDestroy {
  private readonly stateChanges = new Subject<SlideExerciseRuntimeState>();
  private context: SlideContentContext | null = null;
  private type: GeneratedType = 'dictation';
  private items: readonly SlideSequenceVocabularyItem[] = [];
  readonly stateChange = this.stateChanges.asObservable();
  readonly total = signal(0);

  load(context: SlideContentContext): void {
    if (!context.deck) throw new Error('Slide deck controller is unavailable.');
    const environment = record(context.environment) as unknown as ExerciseContext | null;
    const payload = parseSlideSequenceVocabularyPayload(environment?.payload);
    this.context = context;
    this.type = generatedType(context.data);
    this.items = payload.items;
    this.total.set(payload.items.length);
    this.stateChanges.next({
      chrome: {
        footer: {
          primary: { id: 'start-vocabulary-scope', label: "Let's go", behavior: 'content', disabled: false },
          secondary: false,
        },
      },
    });
  }

  handleAction(actionId: string): void {
    const context = this.context;
    if (actionId !== 'start-vocabulary-scope' || !context?.deck) return;
    context.deck.insertSlides({
      anchorId: context.slideId,
      gap: 0,
      slides: buildLessonVocabularySlides(context.slideId, this.type, this.items),
    });
    context.deck.next();
  }

  ngOnDestroy(): void {
    this.stateChanges.complete();
  }
}
