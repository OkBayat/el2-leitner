import { describe, expect, it } from 'vitest';
import {
  addDays, applyReview, buildWeightedBoxOneCycle, createFreshState, createWord,
  ensureDailyWords, isCorrectAnswer, mergeImportedWords, normalizeAnswer, parseWordFile,
} from './learning-rules';

function stateWithWord(box = 1, due = '2026-09-01') {
  const state = createFreshState([{ term: 'environment', accepted: ['environment'], box, due, introducedOn: '2026-08-01' }], new Date('2026-08-01T10:00:00Z'));
  state.words[0].box = box;
  state.words[0].due = due;
  state.words[0].introducedOn = '2026-08-01';
  return state;
}

describe('learning rules regression', () => {
  it('normalizes answers and accepted spelling variants', () => {
    expect(normalizeAnswer('  Credit   Card  ')).toBe('credit card');
    expect(normalizeAnswer('taxpayers’ money')).toBe("taxpayers' money");
    expect(isCorrectAnswer('CENTER', { accepted: ['centre', 'center'] })).toBe(true);
  });

  it('crosses calendar boundaries correctly', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('activates exactly the daily target of unseen words', () => {
    const sources = Array.from({ length: 15 }, (_, index) => ({ term: `word-${index + 1}` }));
    const initial = createFreshState(sources, new Date('2026-09-01T08:00:00Z'));
    const { state, activated } = ensureDailyWords(initial, '2026-09-01');
    expect(activated).toHaveLength(10);
    expect(state.words.filter((word) => word.box === 1)).toHaveLength(10);
    expect(state.daily['2026-09-01'].newAdded).toBe(10);
  });

  it('wrong answers return a card to box one and lock promotion until tomorrow', () => {
    const result = applyReview(stateWithWord(4), 'word-1', 'enviroment', 'review', new Date('2026-09-01T10:00:00'));
    expect(result.word.box).toBe(1);
    expect(result.word.due).toBe('2026-09-02');
    expect(result.word.blockedUntil).toBe('2026-09-02');
    expect(result.word.mistakes).toBe(1);
    expect(result.event.correct).toBe(false);
  });

  it('promotes a due card only once per calendar day', () => {
    const first = applyReview(stateWithWord(2), 'word-1', 'environment', 'review', new Date('2026-09-01T10:00:00'));
    expect(first.word.box).toBe(3);
    expect(first.word.due).toBe('2026-09-04');
    first.word.due = '2026-09-01';
    const second = applyReview(first.state, first.word.id, 'environment', 'review', new Date('2026-09-01T12:00:00'));
    expect(second.word.box).toBe(3);
  });

  it('keeps ordinary free practice in place but preserves the fresh box-one graduation behavior', () => {
    const ordinary = stateWithWord(1);
    ordinary.words[0].mistakes = 2;
    const ordinaryResult = applyReview(ordinary, ordinary.words[0].id, 'environment', 'box1', new Date('2026-09-01T10:00:00'));
    expect(ordinaryResult.word.box).toBe(1);

    const fresh = stateWithWord(1);
    fresh.words[0].mistakes = 0;
    fresh.words[0].lastPromotedDay = null;
    const freshResult = applyReview(fresh, fresh.words[0].id, 'environment', 'box1', new Date('2026-09-01T10:00:00'));
    expect(freshResult.word.box).toBe(2);
  });

  it('graduates a due box-five success out of scheduled review', () => {
    const result = applyReview(stateWithWord(5), 'word-1', 'environment', 'review', new Date('2026-09-01T10:00:00'));
    expect(result.word.box).toBe(5);
    expect(result.word.due).toBeNull();
    expect(result.word.masteredAt).toBeTruthy();
    expect(result.event.promoted).toBe(true);
  });

  it('weights box-one practice toward mistakes and avoids an immediate repeat', () => {
    const words = [
      createWord({ id: 'a', term: 'a', box: 1, mistakes: 8 }),
      createWord({ id: 'b', term: 'b', box: 1, mistakes: 0 }),
      createWord({ id: 'c', term: 'c', box: 1, mistakes: 0 }),
    ];
    const cycle = buildWeightedBoxOneCycle(words, 'a', () => 0);
    expect(cycle[0]).not.toBe('a');
    expect(new Set(cycle).size).toBe(3);
  });

  it('parses markdown and rejects duplicate accepted variants on import', () => {
    const parsed = parseWordFile('# Unit 1\n1. centre / center\n2. unique-word');
    expect(parsed).toHaveLength(2);
    const state = createFreshState([{ term: 'center', accepted: ['center', 'centre'] }]);
    const result = mergeImportedWords(state, '# Unit 1\n1. centre / center\n2. unique-word');
    expect(result.found).toBe(2);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
