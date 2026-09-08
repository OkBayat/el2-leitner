import {
  parseSlideSequenceExerciseSlides,
  type SlideSequenceExerciseSlide,
} from './slide-sequence-exercise';

export type SlideBaseExerciseSlide = SlideSequenceExerciseSlide;

export function parseSlideBaseExerciseSlides(configValue: unknown): readonly SlideBaseExerciseSlide[] {
  return parseSlideSequenceExerciseSlides(configValue);
}
