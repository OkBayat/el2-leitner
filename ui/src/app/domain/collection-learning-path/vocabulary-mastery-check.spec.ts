import { describe, expect, it } from 'vitest';
import {
  parseVocabularyMasteryCheckPayload,
  parseVocabularyMasteryCheckStart,
} from './vocabulary-mastery-check';

describe('vocabulary mastery check payloads', () => {
  it('parses the scoped mastered queue without inventing a pass threshold', () => {
    expect(parseVocabularyMasteryCheckPayload({
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items: [{ id: 'mastered-1', term: 'persistent' }],
      summary: { eligibleCount: 1 },
    })).toEqual({
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items: [{ id: 'mastered-1', term: 'persistent' }],
      summary: { eligibleCount: 1 },
    });
  });

  it('rejects duplicate ids or inconsistent summaries', () => {
    expect(() => parseVocabularyMasteryCheckPayload({
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items: [{ id: 'mastered-1', term: 'persistent' }, { id: 'mastered-1', term: 'duplicate' }],
      summary: { eligibleCount: 2 },
    })).toThrow();
    expect(() => parseVocabularyMasteryCheckPayload({
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items: [{ id: 'mastered-1', term: 'persistent' }],
      summary: { eligibleCount: 2 },
    })).toThrow();
  });

  it('parses a server-started mastery session and preserves authoritative order', () => {
    const result = parseVocabularyMasteryCheckStart({
      pathId: 'path-1',
      lessonId: 'lesson-1',
      exerciseId: 'mastery-1',
      session: { id: 'session-1', mode: 'learning-path.mastery-check', status: 'active', plannedCount: 2 },
      payload: {
        scope: { kind: 'listening-episode', ref: 'episode-1' },
        items: [{ id: 'b', term: 'beta' }, { id: 'a', term: 'alpha' }],
        summary: { eligibleCount: 2 },
      },
    });
    expect(result.session?.id).toBe('session-1');
    expect(result.payload.items.map((item) => item.id)).toEqual(['b', 'a']);
  });
});
