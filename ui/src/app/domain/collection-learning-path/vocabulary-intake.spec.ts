import { describe, expect, it } from 'vitest';
import {
  parseVocabularyIntakePayload,
  vocabularyIntakeNeedsPractice,
  vocabularyIntakePracticeItems,
  vocabularyIntakeStateLabel,
} from './vocabulary-intake';

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

  it('practices new and Box 1 words while leaving later Leitner boxes out', () => {
    const candidates = [
      { ...payload.items[0], progress: { state: 'new' as const, box: 0 } },
      { ...payload.items[0], id: 'box-1', progress: { state: 'learning' as const, box: 1 } },
      { ...payload.items[0], id: 'box-2', progress: { state: 'learning' as const, box: 2 } },
      { ...payload.items[0], id: 'done', progress: { state: 'mastered' as const, box: 5 } },
      { ...payload.items[0], id: 'excluded', progress: { state: 'excluded' as const, box: 0 } },
    ];
    expect(candidates.map(vocabularyIntakeNeedsPractice)).toEqual([true, true, false, false, false]);

    const parsed = parseVocabularyIntakePayload({
      scope: payload.scope,
      items: candidates,
      summary: { total: 5, newCount: 1, learningCount: 2, masteredCount: 1, excludedCount: 1 },
    });
    expect(vocabularyIntakePracticeItems(parsed).map((item) => item.id)).toEqual(['v-1', 'box-1']);
  });
});
