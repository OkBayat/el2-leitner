import { describe, expect, it } from 'vitest';
import { parseVocabularyIntakePayload, vocabularyIntakeStateLabel } from './vocabulary-intake';

const payload = {
  scope: { kind: 'listening-episode', ref: 'episode-1' },
  items: [
    { id: 'v-1', term: 'persist', definitions: ['continue to exist'], examples: ['The habit persisted.'], progress: { state: 'new', box: 0 } },
    { id: 'v-2', term: 'mastered', definitions: [], examples: [], progress: { state: 'mastered', box: 5 } },
  ],
  summary: { total: 2, newCount: 1, learningCount: 0, masteredCount: 1, excludedCount: 0 },
};

describe('vocabulary intake payload', () => {
  it('parses the server-owned scoped vocabulary state', () => {
    const parsed = parseVocabularyIntakePayload(payload);
    expect(parsed.scope).toEqual({ kind: 'listening-episode', ref: 'episode-1' });
    expect(parsed.items.map((item) => vocabularyIntakeStateLabel(item))).toEqual(['New', 'Mastered']);
  });

  it('accepts collection-section scopes used by finite file-managed courses', () => {
    const parsed = parseVocabularyIntakePayload({
      ...payload,
      scope: { kind: 'collection-section', ref: 'section-unit-01' },
    });
    expect(parsed.scope).toEqual({ kind: 'collection-section', ref: 'section-unit-01' });
  });

  it('rejects unknown scope kinds instead of widening the client contract', () => {
    expect(() => parseVocabularyIntakePayload({
      ...payload,
      scope: { kind: 'arbitrary-query', ref: 'unsafe' },
    })).toThrow('Invalid vocabulary intake payload.');
  });

  it('rejects inconsistent summary counts instead of inventing UI state', () => {
    expect(() => parseVocabularyIntakePayload({ ...payload, summary: { ...payload.summary, total: 3 } })).toThrow(
      'Invalid vocabulary intake payload.',
    );
  });
});
