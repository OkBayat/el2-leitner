export interface SlideSequenceExerciseSlide {
  readonly id: string;
  readonly type: string;
  readonly data?: unknown;
  readonly chrome?: Readonly<Record<string, unknown>>;
  readonly terminal?: boolean;
  readonly rootSlideId?: string;
  readonly retryNumber?: number;
  readonly itemId?: string;
}

export interface SlideSequenceExerciseDefinition {
  readonly slides: readonly SlideSequenceExerciseSlide[];
  readonly retryIncorrect: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseSlideSequenceExercise(
  configValue: unknown,
): SlideSequenceExerciseDefinition {
  const config = record(configValue);
  if (!config || !Array.isArray(config['slides']) || config['slides'].length === 0) {
    throw new Error('Slide sequence exercise slides are unavailable.');
  }
  const slides = config['slides'].map((value) => {
    const source = record(value);
    const id = String(source?.['id'] ?? '').trim();
    const type = String(source?.['type'] ?? '').trim();
    if (!source || !id || !type) {
      throw new Error('Every slide sequence exercise slide requires an id and type.');
    }
    return {
      id,
      type,
      data: source['data'],
      chrome: record(source['chrome']) ?? undefined,
      terminal: source['terminal'] === true,
      rootSlideId: String(source['rootSlideId'] ?? '').trim() || undefined,
      retryNumber: Number.isSafeInteger(source['retryNumber'])
        ? Number(source['retryNumber'])
        : undefined,
      itemId: String(source['itemId'] ?? '').trim() || undefined,
    };
  });
  if (new Set(slides.map((slide) => slide.id)).size !== slides.length) {
    throw new Error('Slide sequence exercise slide ids must be unique.');
  }
  const terminalSlides = slides.filter((slide) => slide.terminal);
  if (terminalSlides.length !== 1 || slides.at(-1)?.terminal !== true) {
    throw new Error('Slide sequence exercise requires exactly one terminal last slide.');
  }
  return {
    slides,
    retryIncorrect: config['retryIncorrect'] === true,
  };
}

export function parseSlideSequenceExerciseSlides(
  configValue: unknown,
): readonly SlideSequenceExerciseSlide[] {
  return parseSlideSequenceExercise(configValue).slides;
}
