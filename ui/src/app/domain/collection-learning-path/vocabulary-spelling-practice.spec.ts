import { describe, expect, it } from 'vitest';
import { parseVocabularySpellingStart } from './vocabulary-spelling-practice';

describe('vocabulary spelling payload', () => {
  it('parses one server-selected House 1 snapshot and its persisted session', () => {
    const result = parseVocabularySpellingStart({
      session: { id: 'session-1' },
      payload: {
        scope: 'course',
        items: [{ id: 'course-a', term: 'alpha', accepted: ['alpha'] }],
        summary: { box: 1, eligibleCount: 1 },
      },
    });

    expect(result.session?.id).toBe('session-1');
    expect(result.payload.items.map((item) => item.id)).toEqual(['course-a']);
    expect(result.payload.summary).toEqual({ box: 1, eligibleCount: 1 });
  });

  it('accepts an empty selection without a session and rejects mismatched counts', () => {
    expect(parseVocabularySpellingStart({
      session: null,
      payload: { scope: 'all', items: [], summary: { box: 1, eligibleCount: 0 } },
    }).session).toBeNull();
    expect(() => parseVocabularySpellingStart({
      session: { id: 'session-1' },
      payload: { scope: 'all', items: [], summary: { box: 1, eligibleCount: 1 } },
    })).toThrow(/response/iu);
  });
});
