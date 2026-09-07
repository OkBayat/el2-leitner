import type { VocabularyIntakeItem, VocabularyIntakePayload } from '../../../../domain/collection-learning-path/vocabulary-intake';
import { vocabularyIntakePracticeItems } from '../../../../domain/collection-learning-path/vocabulary-intake';
import type {
  MultipleChoiceSlideData,
  SlideExerciseSlide,
  SlideExerciseSummaryMetric,
} from '../../../../shared/slide-exercise';

export const VOCABULARY_INTAKE_INTRO_SLIDE_ID = 'vocabulary-intake-intro';
export const VOCABULARY_INTAKE_SUMMARY_SLIDE_ID = 'vocabulary-intake-summary';

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return hash;
}

function firstDefinition(item: VocabularyIntakeItem): string {
  const definition = item.definitions[0]?.trim() ?? '';
  if (!definition) throw new Error(`Definition is unavailable for ${item.term}.`);
  return definition;
}

function definitionPool(payload: VocabularyIntakePayload): readonly string[] {
  return [...new Set(payload.items.map((item) => item.definitions[0]?.trim() ?? '').filter(Boolean))];
}

function questionData(payload: VocabularyIntakePayload, item: VocabularyIntakeItem): MultipleChoiceSlideData {
  const correct = firstDefinition(item);
  const distractors = definitionPool(payload).filter((definition) => definition !== correct);
  if (distractors.length < 2) throw new Error('At least three distinct vocabulary definitions are required.');
  const offset = stableHash(item.id) % distractors.length;
  const firstDistractor = distractors[offset];
  const secondDistractor = distractors[(offset + 1) % distractors.length];
  const labels = [correct, firstDistractor, secondDistractor];
  const rotation = stableHash(`${item.id}:options`) % labels.length;
  const ordered = [...labels.slice(rotation), ...labels.slice(0, rotation)];
  const options = ordered.map((label, index) => ({ id: `${item.id}-option-${index + 1}`, label }));
  const correctOptionId = options.find((option) => option.label === correct)?.id ?? '';
  return {
    instruction: 'Choose the correct meaning.',
    prompt: item.term,
    options,
    correctOptionId,
    correctTitle: 'Correct',
    incorrectTitle: 'Not quite',
  };
}

function summaryData(correct: number, incorrect: number): Record<string, unknown> {
  const metrics: SlideExerciseSummaryMetric[] = [
    { label: 'Correct', value: correct },
    { label: 'Incorrect', value: incorrect },
  ];
  return {
    eyebrow: 'Vocabulary complete',
    title: 'Nice work!',
    subtitle: 'Your answers for this vocabulary round.',
    metrics,
  };
}

export function buildVocabularyIntakeSlides(payload: VocabularyIntakePayload): readonly SlideExerciseSlide[] {
  const practiceItems = vocabularyIntakePracticeItems(payload);
  const intro: SlideExerciseSlide = {
    id: VOCABULARY_INTAKE_INTRO_SLIDE_ID,
    type: 'message',
    data: {
      eyebrow: 'Vocabulary',
      title: 'Ready to practice?',
      body: `${payload.summary.total} words · ${payload.summary.masteredCount} mastered · ${practiceItems.length} to practice`,
    },
    chrome: {
      header: { visible: false },
      footer: {
        primary: { id: 'start-practice', label: "Let's Go", behavior: 'emit' },
        secondary: false,
      },
    },
  };
  const questions = practiceItems.map((item, index) => ({
    id: `vocabulary-intake-question-${item.id}`,
    type: 'multiple-choice',
    data: questionData(payload, item),
    chrome: {
      header: {
        visible: true,
        progress: {
          value: ((index + 1) / Math.max(1, practiceItems.length)) * 100,
          label: `Word ${index + 1} of ${practiceItems.length}`,
        },
      },
      footer: { secondary: false },
    },
  } satisfies SlideExerciseSlide<MultipleChoiceSlideData>));
  const summary: SlideExerciseSlide = {
    id: VOCABULARY_INTAKE_SUMMARY_SLIDE_ID,
    type: 'summary',
    data: summaryData(0, 0),
    chrome: {
      footer: {
        primary: { id: 'finish', label: 'Finish', behavior: 'next' },
        secondary: false,
      },
    },
  };
  return [intro, ...questions, summary];
}

export function firstVocabularyIntakePracticeSlideId(slides: readonly SlideExerciseSlide[]): string {
  return slides.find((slide) => slide.type === 'multiple-choice')?.id ?? VOCABULARY_INTAKE_SUMMARY_SLIDE_ID;
}

export function withVocabularyIntakeScore(
  slides: readonly SlideExerciseSlide[],
  correct: number,
  incorrect: number,
): readonly SlideExerciseSlide[] {
  return slides.map((slide) => slide.id === VOCABULARY_INTAKE_SUMMARY_SLIDE_ID
    ? { ...slide, data: summaryData(correct, incorrect) }
    : slide);
}
