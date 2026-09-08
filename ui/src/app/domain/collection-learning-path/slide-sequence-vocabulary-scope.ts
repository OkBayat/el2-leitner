export interface SlideSequenceVocabularyItem {
  readonly id: string;
  readonly term: string;
  readonly definitions: readonly string[];
}

export interface SlideSequenceVocabularyPayload {
  readonly scope: { readonly kind: string; readonly ref: string };
  readonly items: readonly SlideSequenceVocabularyItem[];
  readonly summary: { readonly total: number };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid lesson vocabulary response.');
  }
  return value as Record<string, unknown>;
}

export function parseSlideSequenceVocabularyPayload(value: unknown): SlideSequenceVocabularyPayload {
  const source = object(value);
  const scope = object(source['scope']);
  const kind = String(scope['kind'] ?? '').trim();
  const ref = String(scope['ref'] ?? '').trim();
  if (!kind || !ref || !Array.isArray(source['items'])) throw new Error('Invalid lesson vocabulary response.');
  const seen = new Set<string>();
  const items = source['items'].map((candidate) => {
    const item = object(candidate);
    const id = String(item['id'] ?? '').trim();
    const term = String(item['term'] ?? '').trim();
    const definitions = Array.isArray(item['definitions'])
      ? item['definitions'].map((definition) => String(definition ?? '').trim()).filter(Boolean)
      : [];
    if (!id || !term || !definitions.length || seen.has(id)) throw new Error('Invalid lesson vocabulary response.');
    seen.add(id);
    return { id, term, definitions };
  });
  const summary = object(source['summary']);
  if (!items.length || Number(summary['total']) !== items.length) throw new Error('Invalid lesson vocabulary response.');
  return { scope: { kind, ref }, items, summary: { total: items.length } };
}
