import type { VocabularySpellingItem } from '../../../../domain/collection-learning-path/vocabulary-spelling-practice';
import type { DictationSlideData, SlideExerciseSlide } from '../../../../shared/slide-exercise';

export interface GeneratedVocabularySlide {
  readonly type: string;
}

export function buildLeitnerVocabularySlides(
  scopeSlideId: string,
  generatedSlide: GeneratedVocabularySlide,
  items: readonly VocabularySpellingItem[],
): readonly SlideExerciseSlide[] {
  if (generatedSlide.type !== 'dictation') throw new Error(`Unsupported generated slide type: ${generatedSlide.type}`);
  return items.map((item, index) => ({
    id: `${scopeSlideId}-${item.id}`,
    rootSlideId: `${scopeSlideId}-${item.id}`,
    retryNumber: 0,
    itemId: item.id,
    type: 'dictation',
    data: {
      mode: 'word',
      instruction: 'Listen and type the spelling.',
      speech: { text: item.term, autoplay: true, replay: true },
      answer: item.term,
      acceptedAnswers: item.accepted,
      caseSensitive: false,
      punctuationSensitive: false,
    },
    chrome: {
      header: {
        visible: true,
        progress: {
          value: ((index + 1) / Math.max(1, items.length)) * 100,
          label: `Word ${index + 1} of ${items.length}`,
        },
      },
      footer: { secondary: false },
    },
  } satisfies SlideExerciseSlide<DictationSlideData>));
}
