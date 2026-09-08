import { parseVocabularyScope, type VocabularyScope } from './vocabulary-scope';

export interface VocabularyMasteryCheckItem {
  readonly id: string;
  readonly term: string;
}

export interface VocabularyMasteryCheckPayload {
  readonly scope: VocabularyScope;
  readonly items: readonly VocabularyMasteryCheckItem[];
  readonly summary: { readonly eligibleCount: number };
}

export interface VocabularyMasteryCheckSessionView {
  readonly id: string;
  readonly mode: 'learning-path.mastery-check';
  readonly status: string;
  readonly plannedCount: number | null;
}

export interface VocabularyMasteryCheckStartView {
  readonly pathId: string;
  readonly lessonId: string;
  readonly exerciseId: string;
  readonly session: VocabularyMasteryCheckSessionView | null;
  readonly payload: VocabularyMasteryCheckPayload;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid vocabulary mastery check payload.');
  return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
  const id = String(value ?? '').trim();
  if (!id) throw new Error('Invalid vocabulary mastery check identifier.');
  return id;
}

export function parseVocabularyMasteryCheckPayload(value: unknown): VocabularyMasteryCheckPayload {
  const root = object(value);
  const scope = parseVocabularyScope(root['scope'], 'Invalid vocabulary mastery check payload.');
  const summary = object(root['summary']);
  const rawItems = Array.isArray(root['items']) ? root['items'] : null;
  if (!rawItems) throw new Error('Invalid vocabulary mastery check payload.');
  const eligibleCount = Number(summary['eligibleCount']);
  if (!Number.isSafeInteger(eligibleCount) || eligibleCount < 0) throw new Error('Invalid vocabulary mastery check summary.');
  const seen = new Set<string>();
  const items = rawItems.map((raw) => {
    const item = object(raw);
    const id = identifier(item['id']);
    const term = identifier(item['term']);
    if (seen.has(id)) throw new Error('Duplicate vocabulary mastery check item.');
    seen.add(id);
    return { id, term };
  });
  if (items.length !== eligibleCount) throw new Error('Vocabulary mastery check summary does not match its items.');
  return { scope, items, summary: { eligibleCount } };
}

export function parseVocabularyMasteryCheckStart(value: unknown): VocabularyMasteryCheckStartView {
  const root = object(value);
  const rawSession = root['session'];
  let session: VocabularyMasteryCheckSessionView | null = null;
  if (rawSession !== null && rawSession !== undefined) {
    const source = object(rawSession);
    const mode = String(source['mode'] ?? '');
    const plannedCount = source['plannedCount'] === null ? null : Number(source['plannedCount']);
    if (mode !== 'learning-path.mastery-check' || (plannedCount !== null && (!Number.isSafeInteger(plannedCount) || plannedCount < 0))) {
      throw new Error('Invalid vocabulary mastery check session.');
    }
    session = {
      id: identifier(source['id']),
      mode: 'learning-path.mastery-check',
      status: identifier(source['status']),
      plannedCount,
    };
  }
  const payload = parseVocabularyMasteryCheckPayload(root['payload']);
  if (session && session.plannedCount !== payload.summary.eligibleCount) {
    throw new Error('Vocabulary mastery check session does not match its payload.');
  }
  if (!session && payload.summary.eligibleCount !== 0) {
    throw new Error('Vocabulary mastery check session is required for a non-empty payload.');
  }
  return {
    pathId: identifier(root['pathId']),
    lessonId: identifier(root['lessonId']),
    exerciseId: identifier(root['exerciseId']),
    session,
    payload,
  };
}
