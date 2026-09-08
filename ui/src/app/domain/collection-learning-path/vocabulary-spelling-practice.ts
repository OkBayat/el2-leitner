export type VocabularySpellingScope = 'course' | 'all';

export interface VocabularySpellingItem {
  readonly id: string;
  readonly term: string;
  readonly accepted: readonly string[];
}

export interface VocabularySpellingStartView {
  readonly session: { readonly id: string } | null;
  readonly payload: {
    readonly scope: VocabularySpellingScope;
    readonly items: readonly VocabularySpellingItem[];
    readonly summary: { readonly box: 1; readonly eligibleCount: number };
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid vocabulary spelling response.');
  return value as Record<string, unknown>;
}

function items(value: unknown): readonly VocabularySpellingItem[] {
  if (!Array.isArray(value)) throw new Error('Invalid vocabulary spelling response.');
  const seen = new Set<string>();
  return value.map((raw) => {
    const source = object(raw);
    const id = String(source['id'] ?? '').trim();
    const term = String(source['term'] ?? '').trim();
    const accepted = Array.isArray(source['accepted'])
      ? [...new Set(source['accepted'].map((item) => String(item ?? '').trim()).filter(Boolean))]
      : [];
    if (!id || !term || !accepted.length || seen.has(id)) throw new Error('Invalid vocabulary spelling response.');
    seen.add(id);
    return { id, term, accepted };
  });
}

export function parseVocabularySpellingStart(value: unknown): VocabularySpellingStartView {
  const source = object(value);
  const payload = object(source['payload']);
  const scope = String(payload['scope'] ?? '').trim();
  const selectedItems = items(payload['items']);
  const summary = object(payload['summary']);
  const box = Number(summary['box']);
  const eligibleCount = Number(summary['eligibleCount']);
  const sessionSource = source['session'] === null ? null : object(source['session']);
  const sessionId = sessionSource ? String(sessionSource['id'] ?? '').trim() : '';
  if ((scope !== 'course' && scope !== 'all') || box !== 1 || eligibleCount !== selectedItems.length) {
    throw new Error('Invalid vocabulary spelling response.');
  }
  if ((eligibleCount > 0 && !sessionId) || (eligibleCount === 0 && sessionSource !== null)) {
    throw new Error('Invalid vocabulary spelling response.');
  }
  return {
    session: sessionId ? { id: sessionId } : null,
    payload: { scope, items: selectedItems, summary: { box: 1, eligibleCount } },
  };
}
