export type VocabularyIntakeProgressState = 'new' | 'learning' | 'mastered' | 'excluded';
export type VocabularyIntakeScopeKind = 'listening-episode' | 'collection-section';

export interface VocabularyIntakeItem {
  id: string;
  term: string;
  definitions: string[];
  examples: string[];
  progress: {
    state: VocabularyIntakeProgressState;
    box: number;
  };
}

export interface VocabularyIntakePayload {
  scope: {
    kind: VocabularyIntakeScopeKind;
    ref: string;
  };
  items: VocabularyIntakeItem[];
  summary: {
    total: number;
    newCount: number;
    learningCount: number;
    masteredCount: number;
    excludedCount: number;
  };
}

export interface VocabularyIntakeActivationView {
  pathId: string;
  lessonId: string;
  exerciseId: string;
  exerciseStatus: string;
  activatedCount: number;
  revision: number | null;
  summary: VocabularyIntakePayload['summary'];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid vocabulary intake payload.');
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new Error('Invalid vocabulary intake payload.');
  return result;
}

function texts(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Invalid vocabulary intake payload.');
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function count(value: unknown): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid vocabulary intake payload.');
  return number;
}

function progressState(value: unknown): VocabularyIntakeProgressState {
  if (value === 'new' || value === 'learning' || value === 'mastered' || value === 'excluded') return value;
  throw new Error('Invalid vocabulary intake payload.');
}

function scopeKind(value: unknown): VocabularyIntakeScopeKind {
  if (value === 'listening-episode' || value === 'collection-section') return value;
  throw new Error('Invalid vocabulary intake payload.');
}

export function parseVocabularyIntakePayload(value: unknown): VocabularyIntakePayload {
  const source = record(value);
  const scope = record(source['scope']);
  const parsedScopeKind = scopeKind(scope['kind']);
  if (!Array.isArray(source['items'])) throw new Error('Invalid vocabulary intake payload.');
  const items = source['items'].map((rawItem) => {
    const item = record(rawItem);
    const progress = record(item['progress']);
    return {
      id: text(item['id']),
      term: text(item['term']),
      definitions: texts(item['definitions']),
      examples: texts(item['examples']),
      progress: {
        state: progressState(progress['state']),
        box: count(progress['box']),
      },
    } satisfies VocabularyIntakeItem;
  });
  const summary = record(source['summary']);
  const parsed: VocabularyIntakePayload = {
    scope: { kind: parsedScopeKind, ref: text(scope['ref']) },
    items,
    summary: {
      total: count(summary['total']),
      newCount: count(summary['newCount']),
      learningCount: count(summary['learningCount']),
      masteredCount: count(summary['masteredCount']),
      excludedCount: count(summary['excludedCount']),
    },
  };
  const sum = parsed.summary.newCount
    + parsed.summary.learningCount
    + parsed.summary.masteredCount
    + parsed.summary.excludedCount;
  if (parsed.summary.total !== parsed.items.length || sum !== parsed.summary.total) {
    throw new Error('Invalid vocabulary intake payload.');
  }
  return parsed;
}

export function vocabularyIntakeStateLabel(item: VocabularyIntakeItem): string {
  if (item.progress.state === 'new') return 'New';
  if (item.progress.state === 'mastered') return 'Mastered';
  if (item.progress.state === 'excluded') return 'Excluded';
  return item.progress.box > 0 ? `Box ${item.progress.box}` : 'Learning';
}
