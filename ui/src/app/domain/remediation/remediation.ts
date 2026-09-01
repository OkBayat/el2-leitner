import { normalizeAnswer } from '../learning/learning-rules';
import { LearningWord, ReviewMode } from '../learning/models';

export enum RemediationPhase { CORRECTION = 'correction', RECALL = 'recall', COPY = 'copy', COMPLETED = 'completed' }
export enum RemediationContext { IMMEDIATE = 'immediate', RECHECK = 'recheck' }

export interface SpellingOperation { type: 'equal' | 'insert' | 'delete' | 'replace'; answer?: string; target?: string }
export interface SpellingComparison {
  answer: string;
  target: string;
  distance: number;
  operations: SpellingOperation[];
  targetTokens: Array<{ value: string; status: 'correct' | 'missing' | 'changed' }>;
  transposition: { answer: string; target: string } | null;
}

export const defaultNormalize = normalizeAnswer;

export function levenshteinDistance(left: string, right: string): number {
  const a = [...defaultNormalize(left)];
  const b = [...defaultNormalize(right)];
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

export function selectClosestAccepted(answer: string, accepted: string[]): string {
  if (!accepted.length) throw new Error('accepted spellings are required');
  return [...accepted].sort((a, b) => levenshteinDistance(answer, a) - levenshteinDistance(answer, b))[0];
}

function detectTransposition(answer: string, target: string): { answer: string; target: string } | null {
  if (answer.length !== target.length) return null;
  const indexes = [...answer].map((char, index) => char === target[index] ? -1 : index).filter((index) => index >= 0);
  if (indexes.length !== 2 || indexes[1] !== indexes[0] + 1) return null;
  const first = indexes[0];
  if (answer[first] === target[first + 1] && answer[first + 1] === target[first]) {
    return { answer: answer.slice(first, first + 2), target: target.slice(first, first + 2) };
  }
  return null;
}

export function buildSpellingComparison(rawAnswer: string, rawTarget: string): SpellingComparison {
  const answer = defaultNormalize(rawAnswer);
  const target = defaultNormalize(rawTarget);
  const a = [...answer];
  const b = [...target];
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) {
    matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  const operations: SpellingOperation[] = [];
  let i = a.length; let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { operations.push({ type: 'equal', answer: a[i - 1], target: b[j - 1] }); i -= 1; j -= 1; continue; }
    const replace = i > 0 && j > 0 ? matrix[i - 1][j - 1] : Number.POSITIVE_INFINITY;
    const remove = i > 0 ? matrix[i - 1][j] : Number.POSITIVE_INFINITY;
    const insert = j > 0 ? matrix[i][j - 1] : Number.POSITIVE_INFINITY;
    const best = Math.min(replace, remove, insert);
    if (replace === best) { operations.push({ type: 'replace', answer: a[i - 1], target: b[j - 1] }); i -= 1; j -= 1; }
    else if (remove === best) { operations.push({ type: 'delete', answer: a[i - 1] }); i -= 1; }
    else { operations.push({ type: 'insert', target: b[j - 1] }); j -= 1; }
  }
  operations.reverse();
  const targetTokens = operations.filter((op) => op.type !== 'delete').map((op) => ({
    value: op.target || '',
    status: op.type === 'equal' ? 'correct' as const : op.type === 'insert' ? 'missing' as const : 'changed' as const,
  }));
  return { answer, target, distance: matrix[a.length][b.length], operations, targetTokens, transposition: detectTransposition(answer, target) };
}

export function buildOrthographicHint(comparison: SpellingComparison): string {
  if (comparison.transposition) return `Swap “${comparison.transposition.answer}” to “${comparison.transposition.target}”.`;
  const insertions = comparison.operations.filter((op) => op.type === 'insert').map((op) => op.target).filter(Boolean);
  const replacements = comparison.operations.filter((op) => op.type === 'replace');
  if (insertions.length) return `Missing letter${insertions.length > 1 ? 's' : ''}: ${insertions.join(', ')}.`;
  if (replacements.length) return replacements.map((op) => `“${op.answer}” should be “${op.target}”`).join('; ');
  const deletions = comparison.operations.filter((op) => op.type === 'delete').map((op) => op.answer).filter(Boolean);
  return deletions.length ? `Extra letter${deletions.length > 1 ? 's' : ''}: ${deletions.join(', ')}.` : 'Look carefully at the correct spelling once.';
}

export class SameSessionRecheckPolicy {
  constructor(public readonly initialGap = 3, public readonly retryGap = 1, public readonly maxRechecks = 2) {
    if (!Number.isInteger(initialGap) || initialGap < 0) throw new Error('initialGap must be non-negative');
    if (!Number.isInteger(retryGap) || retryGap < 0) throw new Error('retryGap must be non-negative');
    if (!Number.isInteger(maxRechecks) || maxRechecks < 1) throw new Error('maxRechecks must be positive');
  }
  nextRecheck(context: RemediationContext, number: number, correctOnFirstRecall: boolean): { number: number; gap: number } | null {
    if (context === RemediationContext.IMMEDIATE) return { number: 1, gap: this.initialGap };
    if (correctOnFirstRecall || number >= this.maxRechecks) return null;
    return { number: number + 1, gap: this.retryGap };
  }
}

export interface RemediationSnapshot {
  phase: RemediationPhase;
  context: RemediationContext;
  target: string;
  answerVisible: boolean;
  recallFailures: number;
  copyFailures: number;
  comparison: SpellingComparison;
}

export class RemediationAttempt {
  readonly target: string;
  readonly comparison: SpellingComparison;
  phase: RemediationPhase;
  recallFailures = 0;
  copyFailures = 0;
  private firstRecall = true;
  private completedAt: string | null = null;

  private constructor(
    readonly context: RemediationContext,
    readonly wordId: string,
    readonly accepted: string[],
    readonly recheckNumber: number,
    readonly policy: SameSessionRecheckPolicy,
    initialAnswer: string,
    private readonly now: () => string,
  ) {
    if (!wordId) throw new Error('wordId is required');
    if (!accepted.length) throw new Error('accepted spellings are required');
    if (context === RemediationContext.RECHECK && recheckNumber < 1) throw new Error('recheckNumber must be positive');
    this.target = selectClosestAccepted(initialAnswer, accepted);
    this.comparison = buildSpellingComparison(initialAnswer, this.target);
    this.phase = context === RemediationContext.IMMEDIATE ? RemediationPhase.CORRECTION : RemediationPhase.RECALL;
  }

  static immediate({ wordId, accepted, initialAnswer, policy = new SameSessionRecheckPolicy(), now = () => new Date().toISOString() }: {
    wordId: string; accepted: string[]; initialAnswer: string; policy?: SameSessionRecheckPolicy; now?: () => string;
  }): RemediationAttempt {
    return new RemediationAttempt(RemediationContext.IMMEDIATE, wordId, accepted, 0, policy, initialAnswer, now);
  }

  static recheck({ wordId, accepted, recheckNumber, policy = new SameSessionRecheckPolicy(), now = () => new Date().toISOString() }: {
    wordId: string; accepted: string[]; recheckNumber: number; policy?: SameSessionRecheckPolicy; now?: () => string;
  }): RemediationAttempt {
    return new RemediationAttempt(RemediationContext.RECHECK, wordId, accepted, recheckNumber, policy, accepted[0], now);
  }

  snapshot(): RemediationSnapshot {
    return { phase: this.phase, context: this.context, target: this.target, answerVisible: this.phase === RemediationPhase.CORRECTION || this.phase === RemediationPhase.COPY, recallFailures: this.recallFailures, copyFailures: this.copyFailures, comparison: this.comparison };
  }

  acknowledgeCorrection(): void {
    if (this.phase !== RemediationPhase.CORRECTION) throw new Error('Invalid remediation transition');
    this.phase = RemediationPhase.RECALL;
  }

  submitRecall(answer: string): boolean {
    if (this.phase !== RemediationPhase.RECALL) throw new Error('Invalid remediation transition');
    const correct = this.accepted.some((item) => defaultNormalize(item) === defaultNormalize(answer));
    if (correct) { this.complete(); return true; }
    this.recallFailures += 1;
    this.firstRecall = false;
    this.phase = RemediationPhase.COPY;
    return false;
  }

  submitCopy(answer: string): boolean {
    if (this.phase !== RemediationPhase.COPY) throw new Error('Invalid remediation transition');
    const correct = this.accepted.some((item) => defaultNormalize(item) === defaultNormalize(answer));
    if (!correct) { this.copyFailures += 1; return false; }
    this.phase = RemediationPhase.RECALL;
    return true;
  }

  private complete(): void { this.phase = RemediationPhase.COMPLETED; this.completedAt = this.now(); }

  outcome(): { nextRecheck: { number: number; gap: number } | null; correctOnFirstRecall: boolean; completedAt: string | null } {
    if (this.phase !== RemediationPhase.COMPLETED) throw new Error('Remediation is not complete');
    return { nextRecheck: this.policy.nextRecheck(this.context, this.recheckNumber, this.firstRecall), correctOnFirstRecall: this.firstRecall, completedAt: this.completedAt };
  }
}

export interface RecheckItem { word: LearningWord; mode: ReviewMode; recheckNumber: number; remainingCards: number }

export class SameSessionRecheckQueue {
  private items: RecheckItem[] = [];
  get size(): number { return this.items.length; }
  schedule(item: Omit<RecheckItem, 'remainingCards'>, gap: number): void {
    if (!item.word?.id) throw new Error('word is required');
    const existing = this.items.find((entry) => entry.word.id === item.word.id && entry.recheckNumber === item.recheckNumber);
    if (existing) { existing.remainingCards = Math.min(existing.remainingCards, gap); return; }
    this.items.push({ ...item, word: structuredClone(item.word), remainingCards: gap });
  }
  advance(): void { this.items.forEach((item) => { item.remainingCards = Math.max(0, item.remainingCards - 1); }); }
  takeNext({ flush = false } = {}): RecheckItem | null {
    const index = this.items.findIndex((item) => flush || item.remainingCards === 0);
    if (index < 0) return null;
    return this.items.splice(index, 1)[0];
  }
  snapshot(): RecheckItem[] { return structuredClone(this.items); }
  clear(): void { this.items = []; }
}
