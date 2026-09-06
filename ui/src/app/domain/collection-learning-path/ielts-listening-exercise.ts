export interface IeltsListeningExercisePayload {
  readonly reference: {
    readonly lessonSlug: string;
    readonly testId: string;
  };
  readonly lesson: Readonly<Record<string, unknown>> & {
    readonly slug: string;
  };
  readonly test: Readonly<Record<string, unknown>> & {
    readonly id: string;
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

export function parseIeltsListeningExercisePayload(value: unknown): IeltsListeningExercisePayload {
  const root = object(value);
  const reference = object(root?.['reference']);
  const lesson = object(root?.['lesson']);
  const test = object(root?.['test']);
  const lessonSlug = requiredText(reference?.['lessonSlug']);
  const testId = requiredText(reference?.['testId']);
  const hydratedLessonSlug = requiredText(lesson?.['slug']);
  const hydratedTestId = requiredText(test?.['id']);

  if (!root || !reference || !lesson || !test || !lessonSlug || !testId
    || hydratedLessonSlug !== lessonSlug || hydratedTestId !== testId) {
    throw new Error('IELTS listening exercise data is invalid.');
  }

  return {
    reference: { lessonSlug, testId },
    lesson: { ...lesson, slug: lessonSlug },
    test: { ...test, id: testId },
  };
}
