import { parseVocabularyScope, type VocabularyScope } from './vocabulary-scope';

export interface ScopedVocabularyPracticeItem {
  readonly id: string;
  readonly term: string;
}

export interface ScopedVocabularyPracticePayload {
  readonly scope: VocabularyScope;
  readonly items: readonly ScopedVocabularyPracticeItem[];
  readonly summary: { readonly eligibleCount: number; readonly box: 1 };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid scoped vocabulary practice payload.');
  return value as Record<string, unknown>;
}

export function parseScopedVocabularyPracticePayload(value: unknown): ScopedVocabularyPracticePayload {
  const root = object(value);
  const scope = parseVocabularyScope(root['scope'], 'Invalid scoped vocabulary practice payload.');
  const summary = object(root['summary']);
  const rawItems = Array.isArray(root['items']) ? root['items'] : null;
  const eligibleCount = Number(summary['eligibleCount']);
  const box = Number(summary['box']);
  if (!rawItems || !Number.isSafeInteger(eligibleCount) || eligibleCount < 0 || box !== 1) {
    throw new Error('Invalid scoped vocabulary practice payload.');
  }
  const seen = new Set<string>();
  const items = rawItems.map((raw) => {
    const item = object(raw);
    const id = String(item['id'] ?? '').trim();
    const term = String(item['term'] ?? '').trim();
    if (!id || !term || seen.has(id)) throw new Error('Invalid scoped vocabulary practice item.');
    seen.add(id);
    return { id, term };
  });
  if (items.length !== eligibleCount) throw new Error('Scoped vocabulary practice summary does not match its items.');
  return { scope, items, summary: { eligibleCount, box: 1 } };
}
