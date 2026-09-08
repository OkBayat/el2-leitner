export type SlideExerciseFeedbackTone = 'neutral' | 'success' | 'information' | 'warning' | 'error';
export type SlideExerciseActionTone = 'primary' | 'secondary' | 'success' | 'information' | 'warning' | 'error';
export type SlideExerciseActionState = SlideExerciseActionTone | 'disabled';
export type SlideExerciseActionBehavior = 'next' | 'content' | 'emit';
export type SlideExerciseAggregationMode = 'first-attempts' | 'all-attempts' | 'latest-attempts';

export interface SlideExerciseProgressView {
  readonly value: number;
  readonly label?: string;
  readonly detail?: string;
}

export interface SlideExerciseActionConfig {
  readonly id?: string;
  readonly label?: string;
  readonly tone?: SlideExerciseActionTone;
  readonly behavior?: SlideExerciseActionBehavior;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly ariaLabel?: string;
}

export interface SlideExerciseHeaderConfig {
  readonly visible?: boolean;
  readonly progress?: SlideExerciseProgressView | null;
}

export interface SlideExerciseFooterConfig {
  readonly visible?: boolean;
  readonly tone?: SlideExerciseFeedbackTone;
  readonly title?: string;
  readonly detail?: string;
  readonly primary?: SlideExerciseActionConfig | false;
  readonly secondary?: SlideExerciseActionConfig | false;
}

export interface SlideExerciseChromeConfig {
  readonly header?: SlideExerciseHeaderConfig;
  readonly footer?: SlideExerciseFooterConfig;
}

export interface SlideExerciseSlide<TData = unknown> {
  readonly id: string;
  readonly type: string;
  readonly data?: TData;
  readonly chrome?: SlideExerciseChromeConfig;
  readonly terminal?: boolean;
  readonly rootSlideId?: string;
  readonly retryNumber?: number;
  readonly itemId?: string;
}

export interface SlideExerciseResult<TData = unknown> {
  readonly slideId: string;
  readonly rootSlideId: string;
  readonly slideType: string;
  readonly itemId?: string;
  readonly data?: TData;
}

export interface SlideExerciseInsertCommand {
  readonly anchorId: string;
  readonly gap: number;
  readonly slides: readonly SlideExerciseSlide[];
}

export interface SlideExerciseDeckController {
  insertSlides(command: SlideExerciseInsertCommand): void;
  next(): void;
  results(): readonly SlideExerciseResult[];
}

export interface SlideExerciseScore {
  readonly correct: number;
  readonly mistakes: number;
  readonly total: number;
  readonly accuracy: number;
}

export interface SlideExerciseRuntimeState {
  readonly chrome?: SlideExerciseChromeConfig;
}

export interface SlideExerciseActionView {
  readonly id: string;
  readonly label: string;
  readonly tone: SlideExerciseActionTone;
  readonly behavior: SlideExerciseActionBehavior;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly ariaLabel: string;
}

export interface SlideExerciseHeaderView {
  readonly visible: boolean;
  readonly progress: SlideExerciseProgressView | null;
}

export interface SlideExerciseFooterView {
  readonly visible: boolean;
  readonly tone: SlideExerciseFeedbackTone;
  readonly title: string;
  readonly detail: string;
  readonly primary: SlideExerciseActionView | null;
  readonly secondary: SlideExerciseActionView | null;
}

export interface SlideExercisePresentation {
  readonly header: SlideExerciseHeaderView;
  readonly footer: SlideExerciseFooterView;
}

export interface SlideExerciseActionEvent {
  readonly slideId: string;
  readonly actionId: string;
  readonly behavior: SlideExerciseActionBehavior;
  readonly slot: 'primary' | 'secondary';
}

export interface SlideExerciseContentEvent<TData = unknown> {
  readonly slideId: string;
  readonly type: string;
  readonly data?: TData;
}

export interface SlideExerciseSlideChange {
  readonly index: number;
  readonly slideId: string;
}

export interface SlideExerciseSummaryMetric {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

interface PresentationInput {
  readonly slide: SlideExerciseSlide;
  readonly index: number;
  readonly total: number;
  readonly rendererDefaults?: SlideExerciseChromeConfig;
  readonly exerciseDefaults?: SlideExerciseChromeConfig;
  readonly runtime?: SlideExerciseRuntimeState;
}

const DEFAULT_PRIMARY_ACTION: SlideExerciseActionView = {
  id: 'continue',
  label: 'Continue',
  tone: 'primary',
  behavior: 'next',
  disabled: false,
  loading: false,
  ariaLabel: '',
};

const DEFAULT_SECONDARY_ACTION: SlideExerciseActionView = {
  id: 'secondary',
  label: 'Skip',
  tone: 'secondary',
  behavior: 'emit',
  disabled: false,
  loading: false,
  ariaLabel: '',
};

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function actionView(
  current: SlideExerciseActionView | null,
  override: SlideExerciseActionConfig | false,
  fallback: SlideExerciseActionView,
): SlideExerciseActionView | null {
  if (override === false) return null;
  const base = current ?? fallback;
  return {
    id: override.id?.trim() || base.id,
    label: override.label?.trim() || base.label,
    tone: override.tone ?? base.tone,
    behavior: override.behavior ?? base.behavior,
    disabled: override.disabled ?? base.disabled,
    loading: override.loading ?? base.loading,
    ariaLabel: override.ariaLabel?.trim() ?? base.ariaLabel,
  };
}

export function validateSlideExerciseSlides(slides: readonly SlideExerciseSlide[]): readonly SlideExerciseSlide[] {
  if (!slides.length) throw new Error('Slide exercise requires at least one slide.');
  const ids = slides.map((slide) => slide.id.trim());
  const types = slides.map((slide) => slide.type.trim());
  if (ids.some((id) => !id)) throw new Error('Slide ids are required.');
  if (types.some((type) => !type)) throw new Error('Slide types are required.');
  if (new Set(ids).size !== ids.length) throw new Error('Slide ids must be unique.');
  return slides;
}

export function normalizeSlideExerciseProgress(value: number): number {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

function scoredResults(results: readonly SlideExerciseResult[]): Array<SlideExerciseResult & { data: { correct: boolean } }> {
  return results.filter((result): result is SlideExerciseResult & { data: { correct: boolean } } => {
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return false;
    return typeof (result.data as { correct?: unknown }).correct === 'boolean';
  });
}

export function aggregateSlideExerciseResults(
  results: readonly SlideExerciseResult[],
  mode: SlideExerciseAggregationMode = 'first-attempts',
): SlideExerciseScore {
  const scored = scoredResults(results);
  let selected = scored;
  if (mode !== 'all-attempts') {
    const grouped = new Map<string, (typeof scored)[number]>();
    for (const result of scored) {
      if (mode === 'first-attempts' && grouped.has(result.rootSlideId)) continue;
      grouped.set(result.rootSlideId, result);
    }
    selected = [...grouped.values()];
  }
  const correct = selected.filter((result) => result.data.correct).length;
  const mistakes = selected.length - correct;
  return {
    correct,
    mistakes,
    total: selected.length,
    accuracy: selected.length ? Math.round((correct / selected.length) * 100) : 0,
  };
}

export function resolveSlideExerciseActionState(
  tone: SlideExerciseActionTone,
  disabled: boolean,
  loading: boolean,
): SlideExerciseActionState {
  return disabled || loading ? 'disabled' : tone;
}

export function resolveSlideExercisePresentation(input: PresentationInput): SlideExercisePresentation {
  const safeTotal = Math.max(1, Math.trunc(input.total));
  const safeIndex = Math.min(safeTotal - 1, Math.max(0, Math.trunc(input.index)));
  let headerVisible = true;
  let progress: SlideExerciseProgressView | null = {
    value: normalizeSlideExerciseProgress(((safeIndex + 1) / safeTotal) * 100),
    label: `${safeIndex + 1} of ${safeTotal}`,
  };
  let footerVisible = true;
  let footerTone: SlideExerciseFeedbackTone = 'neutral';
  let footerTitle = '';
  let footerDetail = '';
  let primary: SlideExerciseActionView | null = DEFAULT_PRIMARY_ACTION;
  let secondary: SlideExerciseActionView | null = null;

  const layers = [
    input.rendererDefaults,
    input.exerciseDefaults,
    input.slide.chrome,
    input.runtime?.chrome,
  ].filter((layer): layer is SlideExerciseChromeConfig => Boolean(layer));

  for (const layer of layers) {
    if (layer.header) {
      if (hasOwn(layer.header, 'visible')) headerVisible = layer.header.visible !== false;
      if (hasOwn(layer.header, 'progress')) progress = layer.header.progress ?? null;
    }
    if (!layer.footer) continue;
    const footer = layer.footer;
    if (hasOwn(footer, 'visible')) footerVisible = footer.visible !== false;
    if (footer.tone !== undefined) footerTone = footer.tone;
    if (footer.title !== undefined) footerTitle = footer.title;
    if (footer.detail !== undefined) footerDetail = footer.detail;
    if (hasOwn(footer, 'primary')) primary = actionView(primary, footer.primary ?? {}, DEFAULT_PRIMARY_ACTION);
    if (hasOwn(footer, 'secondary')) {
      const value = footer.secondary;
      secondary = value === false ? null : actionView(secondary, value ?? {}, DEFAULT_SECONDARY_ACTION);
    }
  }

  if (progress) progress = { ...progress, value: normalizeSlideExerciseProgress(progress.value) };
  return {
    header: { visible: headerVisible, progress },
    footer: {
      visible: footerVisible,
      tone: footerTone,
      title: footerTitle,
      detail: footerDetail,
      primary,
      secondary,
    },
  };
}
