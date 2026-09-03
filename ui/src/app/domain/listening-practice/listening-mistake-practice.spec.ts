import { describe, expect, it } from 'vitest';
import { createFreshState } from '../learning/learning-rules';
import {
  LISTENING_MISTAKE_CATEGORY,
  LISTENING_MISTAKE_SOURCE,
  captureListeningMistakeInHouseOne,
  listeningVocabularyCandidate,
} from './listening-mistake-practice';

describe('listening mistake vocabulary rules', () => {
  it('offers House 1 capture for any incorrect non-numeric textual answer, including phrases and choices', () => {
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'text', correctAnswer: 'inland' })).toBe('inland');
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'text', correctAnswer: 'well-being' })).toBe('well-being');
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'text', correctAnswer: 'sea levels' })).toBe('sea levels');
    expect(listeningVocabularyCandidate({
      correct: false,
      responseType: 'single_choice',
      correctAnswer: 'B. They remain in the same area for longer.',
    })).toBe('They remain in the same area for longer.');
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'text', correctAnswer: '1C' })).toBeNull();
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'text', correctAnswer: '10' })).toBeNull();
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'text', correctAnswer: '10 metres' })).toBeNull();
    expect(listeningVocabularyCandidate({ correct: false, responseType: 'single_choice', correctAnswer: 'A. 2 degrees' })).toBeNull();
    expect(listeningVocabularyCandidate({ correct: true, responseType: 'text', correctAnswer: 'inland' })).toBeNull();
  });

  it('creates an unknown listening mistake phrase directly in House 1', () => {
    const initial = createFreshState([{ id: 'known', term: 'weather' }], new Date('2026-09-03T08:00:00Z'));
    const result = captureListeningMistakeInHouseOne(initial, 'sea levels', new Date('2026-09-03T10:00:00Z'));

    expect(result.created).toBe(true);
    expect(result.newlyIntroduced).toBe(true);
    expect(result.word.term).toBe('sea levels');
    expect(result.word.accepted).toEqual(['sea levels']);
    expect(result.word.category).toBe(LISTENING_MISTAKE_CATEGORY);
    expect(result.word.box).toBe(1);
    expect(result.word.due).toBe('2026-09-03');
    expect(result.word.introducedOn).toBe('2026-09-03');
    expect(result.word.addedSource).toBe(LISTENING_MISTAKE_SOURCE);
    expect(result.state.daily['2026-09-03'].newAdded).toBe(1);
    expect(initial.words).toHaveLength(1);
  });

  it('rejects any captured answer containing a numeric character', () => {
    const initial = createFreshState([], new Date('2026-09-03T08:00:00Z'));
    expect(() => captureListeningMistakeInHouseOne(initial, '1C')).toThrow(/non-numeric/u);
    expect(() => captureListeningMistakeInHouseOne(initial, 'level 2')).toThrow(/non-numeric/u);
    expect(() => captureListeningMistakeInHouseOne(initial, '۱۲ متر')).toThrow(/non-numeric/u);
  });

  it('moves an existing learned or mastered word back to House 1 without erasing historical counters', () => {
    const initial = createFreshState([{
      id: 'existing',
      term: 'inland',
      accepted: ['inland'],
      box: 5,
      due: null,
      introducedOn: '2026-08-01',
      attempts: 12,
      correct: 9,
      mistakes: 3,
      currentStreak: 4,
      masteredAt: '2026-08-30T10:00:00.000Z',
    }], new Date('2026-08-01T08:00:00Z'));
    const result = captureListeningMistakeInHouseOne(initial, 'INLAND', new Date('2026-09-03T10:00:00Z'));

    expect(result.created).toBe(false);
    expect(result.newlyIntroduced).toBe(false);
    expect(result.word.id).toBe('existing');
    expect(result.word.box).toBe(1);
    expect(result.word.due).toBe('2026-09-03');
    expect(result.word.masteredAt).toBeNull();
    expect(result.word.currentStreak).toBe(0);
    expect(result.word.attempts).toBe(12);
    expect(result.word.correct).toBe(9);
    expect(result.word.mistakes).toBe(3);
    expect(result.state.daily['2026-09-03']).toBeUndefined();
  });
});
