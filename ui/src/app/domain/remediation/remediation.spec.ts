import { describe, expect, it } from 'vitest';
import { createWord } from '../learning/learning-rules';
import {
  buildOrthographicHint, buildSpellingComparison, levenshteinDistance, RemediationAttempt,
  RemediationContext, RemediationPhase, SameSessionRecheckPolicy, SameSessionRecheckQueue,
  selectClosestAccepted,
} from './remediation';

describe('same-session spelling remediation regressions', () => {
  it('builds actionable spelling diffs including missing, replacement and transposition hints', () => {
    const missing = buildSpellingComparison('enviroment', 'environment');
    expect(missing.distance).toBe(1);
    expect(missing.operations.filter((op) => op.type === 'insert').map((op) => op.target).join('')).toBe('n');
    expect(buildOrthographicHint(missing)).toContain('n');
    const replacement = buildSpellingComparison('definate', 'definite');
    expect(replacement.operations.some((op) => op.type === 'replace' && op.answer === 'a' && op.target === 'i')).toBe(true);
    const transpose = buildSpellingComparison('freind', 'friend');
    expect(transpose.transposition).toEqual({ answer: 'ei', target: 'ie' });
    expect(buildOrthographicHint(transpose)).toContain('Swap');
    expect(levenshteinDistance('enviroment', 'environment')).toBe(1);
    expect(selectClosestAccepted('center', ['centre', 'center'])).toBe('center');
  });

  it('preserves the legacy main comparison tokens for correct, changed, missing, and extra letters', () => {
    const replacement = buildSpellingComparison('definate', 'definite');
    expect(replacement.answerTokens.find((token) => token.value === 'a')).toEqual({ value: 'a', status: 'changed' });
    expect(replacement.targetTokens.find((token) => token.value === 'i')).toEqual({ value: 'i', status: 'changed' });
    expect(replacement.answerTokens.some((token) => token.status === 'correct')).toBe(true);
    expect(replacement.targetTokens.some((token) => token.status === 'correct')).toBe(true);

    const missing = buildSpellingComparison('enviroment', 'environment');
    expect(missing.targetTokens.find((token) => token.status === 'missing')).toEqual({ value: 'n', status: 'missing' });

    const extra = buildSpellingComparison('environmentt', 'environment');
    expect(extra.answerTokens.at(-1)).toEqual({ value: 't', status: 'extra' });
  });

  it('enforces correction, hidden recall, copy and final recall', () => {
    const policy = new SameSessionRecheckPolicy(3, 1, 2);
    const attempt = RemediationAttempt.immediate({ wordId: 'environment', accepted: ['environment'], initialAnswer: 'enviroment', policy, now: () => '2026-07-16T10:00:00.000Z' });
    expect(attempt.phase).toBe(RemediationPhase.CORRECTION);
    expect(attempt.snapshot().answerVisible).toBe(true);
    attempt.acknowledgeCorrection();
    expect(attempt.snapshot().answerVisible).toBe(false);
    attempt.submitRecall('envirnment');
    expect(attempt.phase).toBe(RemediationPhase.COPY);
    expect(attempt.submitCopy('environmentt')).toBe(false);
    expect(attempt.submitCopy('environment')).toBe(true);
    expect(attempt.snapshot().answerVisible).toBe(false);
    attempt.submitRecall('environment');
    expect(attempt.outcome().nextRecheck).toEqual({ number: 1, gap: 3 });
    expect(attempt.outcome().correctOnFirstRecall).toBe(false);
  });

  it('ends a successful recheck but schedules one final retry after a failed recheck', () => {
    const policy = new SameSessionRecheckPolicy(3, 1, 2);
    const success = RemediationAttempt.recheck({ wordId: 'environment', accepted: ['environment'], recheckNumber: 1, policy });
    expect(success.context).toBe(RemediationContext.RECHECK);
    success.submitRecall('environment');
    expect(success.outcome().nextRecheck).toBeNull();

    const failed = RemediationAttempt.recheck({ wordId: 'environment', accepted: ['environment'], recheckNumber: 1, policy });
    failed.submitRecall('enviroment');
    failed.submitCopy('environment');
    failed.submitRecall('environment');
    expect(failed.outcome().nextRecheck).toEqual({ number: 2, gap: 1 });
  });

  it('delays and deduplicates queued rechecks and supports finite-session flush', () => {
    const queue = new SameSessionRecheckQueue();
    const word = createWord({ id: 'w1', term: 'environment', accepted: ['environment'], box: 1 });
    queue.schedule({ word, mode: 'box1', recheckNumber: 1 }, 3);
    queue.schedule({ word, mode: 'box1', recheckNumber: 1 }, 1);
    expect(queue.size).toBe(1);
    expect(queue.snapshot()[0].remainingCards).toBe(1);
    expect(queue.takeNext()).toBeNull();
    queue.advance();
    expect(queue.takeNext()?.word.id).toBe('w1');
    queue.schedule({ word, mode: 'review', recheckNumber: 2 }, 4);
    expect(queue.takeNext({ flush: true })?.recheckNumber).toBe(2);
  });
});
