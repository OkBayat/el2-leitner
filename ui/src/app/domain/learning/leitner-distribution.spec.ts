import { describe, expect, it } from 'vitest';
import { createWord } from './learning-rules';
import { buildLeitnerDistribution, segmentIndexForWord, stateCountForHouse } from './leitner-distribution';

describe('Leitner dashboard distribution', () => {
  it('preserves the legacy main state counts for houses 1 through 5', () => {
    expect([1, 2, 3, 4, 5].map((house) => stateCountForHouse(house))).toEqual([1, 2, 3, 7, 14]);
  });

  it('maps active words into the same waiting-day segments as legacy main', () => {
    const today = '2026-09-01';
    const words = [
      createWord({ id: 'h1', term: 'one', box: 1, due: today }),
      createWord({ id: 'h2-a', term: 'two-a', box: 2, due: '2026-09-03' }),
      createWord({ id: 'h2-b', term: 'two-b', box: 2, due: today }),
      createWord({ id: 'h4-a', term: 'four-a', box: 4, due: '2026-09-08' }),
      createWord({ id: 'h4-b', term: 'four-b', box: 4, due: '2026-09-05' }),
      createWord({ id: 'h5-mastered', term: 'done', box: 5, due: null, masteredAt: '2026-08-20T00:00:00.000Z' }),
    ];

    const distribution = buildLeitnerDistribution(words, today);
    expect(distribution.houses.map((house) => house.segments.length)).toEqual([1, 2, 3, 7, 14]);
    expect(distribution.houses[0].segments).toEqual([1]);
    expect(distribution.houses[1].segments).toEqual([1, 1]);
    expect(distribution.houses[3].segments.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(distribution.houses[4].total).toBe(0);
    expect(distribution.total).toBe(5);
  });

  it('advances segment position as the due day approaches', () => {
    const word = createWord({ id: 'h4', term: 'four', box: 4, due: '2026-09-08' });
    expect(segmentIndexForWord(word, 4, '2026-09-01')).toBe(0);
    expect(segmentIndexForWord(word, 4, '2026-09-04')).toBe(3);
    expect(segmentIndexForWord(word, 4, '2026-09-08')).toBe(6);
  });
});
