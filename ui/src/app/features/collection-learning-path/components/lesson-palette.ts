export type LessonTrailPalette = 'green' | 'purple' | 'blue' | 'orange';

const LESSON_TRAIL_PALETTES: readonly LessonTrailPalette[] = ['green', 'purple', 'blue', 'orange'];

export function lessonTrailPalette(position: number): LessonTrailPalette {
  const index = Math.max(0, position - 1) % LESSON_TRAIL_PALETTES.length;
  return LESSON_TRAIL_PALETTES[index];
}
