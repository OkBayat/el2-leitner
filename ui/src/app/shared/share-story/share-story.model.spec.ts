import { describe, expect, it } from 'vitest';
import { createFreshState } from '../../domain/learning/learning-rules';
import { buildShareMoment } from './share-story.model';

describe('public share story model', () => {
  it('contains progress metrics but no private learner details', () => {
    const state = createFreshState([{ term: 'private-word', accepted: ['private-word'] }], new Date('2026-09-01T08:00:00Z'));
    state.history.push({ at: '2026-09-01T09:00:00Z', day: '2026-09-01', wordId: state.words[0].id, term: 'private-word', answer: 'private-answer', correct: false, mode: 'review', promoted: false, previousBox: 1, newBox: 1, mistakeNumber: 1 });
    state.daily['2026-09-01'] = { attempts: 1, correct: 0, wrong: 1, newAdded: 1, sessions: 1, durationSeconds: 30 };
    const serialized = JSON.stringify(buildShareMoment(state, 'daily'));
    expect(serialized).not.toContain('private-word');
    expect(serialized).not.toContain('private-answer');
    expect(serialized).not.toContain('@');
    expect(serialized).toContain('Vocora');
  });
});
