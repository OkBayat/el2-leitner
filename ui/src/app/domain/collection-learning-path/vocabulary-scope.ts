export type VocabularyScopeKind = 'listening-episode' | 'collection-section';

export interface VocabularyScope {
  readonly kind: VocabularyScopeKind;
  readonly ref: string;
}

export function parseVocabularyScope(value: unknown, errorMessage: string): VocabularyScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(errorMessage);
  const source = value as Record<string, unknown>;
  const kind = source['kind'];
  const ref = typeof source['ref'] === 'string' ? source['ref'].trim() : '';
  if ((kind !== 'listening-episode' && kind !== 'collection-section') || !ref) throw new Error(errorMessage);
  return { kind, ref };
}
