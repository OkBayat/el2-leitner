import { describe, expect, it } from 'vitest';
import { ShadowingCard, ShadowingQueue } from './shadowing';

function card(id: string): ShadowingCard {
  return { id, term: 'name', sentences: ['one', 'two'].map(suffix => ({ id: `${id}-${suffix}`, text: 'My name is Sara.', leading: '', words: [], transcript: '', matchedCount: 0, totalCount: 4, score: 0, passed: false })) };
}
describe('ShadowingQueue', () => {
  it('continues indefinitely, avoids immediate duplicate words and changes contexts', () => {
    const queue = new ShadowingQueue([card('a'), card('b')], () => .5);
    const first = queue.next()!; const second = queue.next()!; const third = queue.next()!;
    expect(first.card.id).not.toBe(second.card.id);
    expect(third.card.id).toBe(first.card.id);
    expect(third.sentence.id).not.toBe(first.sentence.id);
  });
  it('handles empty decks and a single word without loops', () => {
    expect(new ShadowingQueue([]).next()).toBeNull();
    const queue = new ShadowingQueue([card('a')], () => 0);
    expect(queue.next()!.sentence.id).not.toBe(queue.next()!.sentence.id);
  });
});
