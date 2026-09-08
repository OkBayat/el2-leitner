import { describe, expect, it } from 'vitest';
import { parseSlideSequenceVocabularyPayload } from './slide-sequence-vocabulary-scope';

describe('slide sequence vocabulary scope', () => {
  it('parses a complete source-scoped vocabulary payload', () => {
    expect(parseSlideSequenceVocabularyPayload({
      scope: { kind: 'collection-section', ref: 'unit-1' },
      items: [{ id: 'word-1', term: 'childhood', definitions: ['the period when a person is a child'] }],
      summary: { total: 1 },
    }).items[0].term).toBe('childhood');
  });

  it('fails closed on missing definitions or a mismatched total', () => {
    expect(() => parseSlideSequenceVocabularyPayload({
      scope: { kind: 'collection-section', ref: 'unit-1' },
      items: [{ id: 'word-1', term: 'childhood', definitions: [] }],
      summary: { total: 2 },
    })).toThrow(/Invalid lesson vocabulary response/);
  });
});
