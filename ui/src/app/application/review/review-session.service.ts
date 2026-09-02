import { Injectable, computed, inject, signal } from '@angular/core';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { ReviewPersistenceService } from '../../core/persistence/review-persistence.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { SpeechService } from '../../core/speech/speech.service';
import {
  applyReview, buildWeightedBoxOneCycle, getDueWords, localDay, todayRecord,
} from '../../domain/learning/learning-rules';
import { LearningWord, ReviewCommand, ReviewMode } from '../../domain/learning/models';
import {
  RemediationAttempt, RemediationPhase, RemediationSnapshot, RecheckItem,
  SameSessionRecheckPolicy, SameSessionRecheckQueue,
} from '../../domain/remediation/remediation';

export interface ReviewFeedback {
  correct: boolean;
  title: string;
  detail: string;
  spelling: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewSessionService {
  private readonly store = inject(LearningStoreService);
  private readonly persistence = inject(ReviewPersistenceService);
  private readonly learningApi = inject(LearningApiService);
  private readonly speech = inject(SpeechService);
  private readonly currentWordSignal = signal<LearningWord | null>(null);
  private readonly activeSignal = signal(false);
  private readonly completedSignal = signal(false);
  private readonly feedbackSignal = signal<ReviewFeedback | null>(null);
  private readonly remediationSignal = signal<RemediationSnapshot | null>(null);
  private readonly canAdvanceSignal = signal(false);
  private readonly answeredSignal = signal(0);
  private readonly correctSignal = signal(0);
  private readonly wrongSignal = signal(0);
  private readonly initialCountSignal = signal(0);
  private readonly currentTaskSignal = signal<'review' | 'recheck'>('review');
  private queue: string[] = [];
  private rechecks = new SameSessionRecheckQueue();
  private remediationAttempt: RemediationAttempt | null = null;
  private currentRecheck: RecheckItem | null = null;
  private mode: ReviewMode = 'review';
  private backendSessionId: string | null = null;
  private startedAt = 0;
  private preparedNewIds: string[] = [];

  readonly currentWord = this.currentWordSignal.asReadonly();
  readonly active = this.activeSignal.asReadonly();
  readonly completed = this.completedSignal.asReadonly();
  readonly feedback = this.feedbackSignal.asReadonly();
  readonly remediation = this.remediationSignal.asReadonly();
  readonly canAdvance = this.canAdvanceSignal.asReadonly();
  readonly answered = this.answeredSignal.asReadonly();
  readonly correct = this.correctSignal.asReadonly();
  readonly wrong = this.wrongSignal.asReadonly();
  readonly initialCount = this.initialCountSignal.asReadonly();
  readonly currentTask = this.currentTaskSignal.asReadonly();
  readonly accuracy = computed(() => this.answeredSignal() ? Math.round((this.correctSignal() / this.answeredSignal()) * 100) : null);
  readonly progress = computed(() => this.mode === 'box1' ? 100 : this.initialCountSignal() ? Math.min(100, Math.round((this.answeredSignal() / this.initialCountSignal()) * 100)) : 0);

  prepareNewWords(ids: string[]): void { this.preparedNewIds = [...ids]; }
  hasPreparedNewWords(): boolean { return this.preparedNewIds.length > 0; }
  isFreePractice(): boolean { return this.mode === 'box1'; }

  async start(mode: ReviewMode = 'review', limit = 0): Promise<boolean> {
    await this.store.initialize();
    const state = this.store.snapshot();
    this.mode = mode;
    this.rechecks.clear();
    this.remediationAttempt = null;
    this.currentRecheck = null;
    if (mode === 'box1') this.queue = buildWeightedBoxOneCycle(state.words);
    else if (mode === 'new') {
      const selected = this.preparedNewIds.length ? this.preparedNewIds : getDueWords(state).filter((word) => word.introducedOn === localDay() && word.box === 1).map((word) => word.id);
      this.queue = [...selected];
      this.preparedNewIds = [];
    } else {
      this.queue = getDueWords(state).map((word) => word.id);
      if (limit > 0) this.queue = this.queue.slice(0, limit);
    }
    if (!this.queue.length) return false;
    const response = await this.learningApi.startSession(mode, this.queue.length);
    this.backendSessionId = response.session.id;
    this.startedAt = Date.now();
    this.initialCountSignal.set(this.queue.length);
    this.answeredSignal.set(0); this.correctSignal.set(0); this.wrongSignal.set(0);
    this.completedSignal.set(false); this.activeSignal.set(true);
    this.nextTask(false);
    return true;
  }

  pronounce(multiplier = 1): boolean {
    const word = this.currentWordSignal();
    if (!word) return false;
    return this.speech.speak(word.term, this.store.snapshot().settings.voiceRate * multiplier);
  }

  async submit(answer: string, forcedWrong = false): Promise<void> {
    const word = this.currentWordSignal();
    if (!word || !this.activeSignal()) return;
    if (this.currentTaskSignal() === 'recheck') {
      this.submitRemediation(answer);
      return;
    }
    const transition = applyReview(this.store.snapshot(), word.id, answer, this.mode, new Date(), forcedWrong);
    const command: ReviewCommand = {
      revision: this.store.revision(),
      practiceSessionId: this.backendSessionId,
      word: {
        id: transition.word.id, box: transition.word.box, due: transition.word.due,
        attempts: transition.word.attempts, correct: transition.word.correct, mistakes: transition.word.mistakes,
        currentStreak: transition.word.currentStreak, introducedOn: transition.word.introducedOn,
        addedSource: transition.word.addedSource, lastReviewed: transition.word.lastReviewed,
        lastPromotedDay: transition.word.lastPromotedDay, blockedUntil: transition.word.blockedUntil,
        masteredAt: transition.word.masteredAt,
      },
      event: transition.event,
      daily: transition.daily,
    };
    const revision = await this.persistence.persist(command);
    this.store.replaceLocal(transition.state, revision);
    this.answeredSignal.update((value) => value + 1);
    if (transition.event.correct) this.correctSignal.update((value) => value + 1);
    else this.wrongSignal.update((value) => value + 1);

    const detail = !transition.event.correct
      ? 'The word returned to House 1 and promotion is locked until tomorrow.'
      : transition.event.promoted
        ? transition.event.previousBox === 5 ? 'Final review completed; the word has left the scheduled review cycle.' : `Moved from House ${transition.event.previousBox} to House ${transition.event.newBox}.`
        : this.mode === 'box1' ? 'Practice recorded; free practice does not change the card’s house.' : 'Correct answer recorded; the next promotion is not due yet.';
    this.feedbackSignal.set({
      correct: transition.event.correct,
      title: transition.event.correct ? 'Correct!' : `This is mistake #${transition.word.mistakes} for this word.`,
      detail,
      spelling: transition.word.accepted.join(' / '),
    });

    if (!transition.event.correct) {
      this.remediationAttempt = RemediationAttempt.immediate({
        wordId: transition.word.id,
        accepted: transition.word.accepted,
        initialAnswer: answer,
        policy: new SameSessionRecheckPolicy(3, 1, 2),
      });
      this.remediationSignal.set(this.remediationAttempt.snapshot());
      this.canAdvanceSignal.set(false);
    } else {
      this.canAdvanceSignal.set(true);
    }
  }

  acknowledgeCorrection(): void {
    if (!this.remediationAttempt) return;
    this.remediationAttempt.acknowledgeCorrection();
    this.remediationSignal.set(this.remediationAttempt.snapshot());
  }

  submitRemediation(answer: string): void {
    const attempt = this.remediationAttempt;
    if (!attempt) return;
    if (attempt.phase === RemediationPhase.RECALL) attempt.submitRecall(answer);
    else if (attempt.phase === RemediationPhase.COPY) attempt.submitCopy(answer);
    if (attempt.phase === RemediationPhase.COMPLETED) {
      const outcome = attempt.outcome();
      const word = this.currentWordSignal();
      if (outcome.nextRecheck && word) {
        this.rechecks.schedule({ word, mode: this.mode, recheckNumber: outcome.nextRecheck.number }, outcome.nextRecheck.gap);
      }
      this.canAdvanceSignal.set(true);
    }
    this.remediationSignal.set(attempt.snapshot());
  }

  async next(): Promise<void> {
    if (!this.canAdvanceSignal()) return;
    const completedReviewCard = this.currentTaskSignal() === 'review';
    this.feedbackSignal.set(null);
    this.remediationSignal.set(null);
    this.remediationAttempt = null;
    this.canAdvanceSignal.set(false);
    if (completedReviewCard) this.rechecks.advance();
    this.nextTask(completedReviewCard);
    if (!this.currentWordSignal()) await this.finish();
  }

  private nextTask(_advanced: boolean): void {
    const availableRecheck = this.rechecks.takeNext();
    if (availableRecheck) { this.openRecheck(availableRecheck); return; }
    if (!this.queue.length && this.mode === 'box1') this.queue = buildWeightedBoxOneCycle(this.store.snapshot().words, this.currentWordSignal()?.id || null);
    const id = this.queue.shift();
    if (id) {
      const word = this.store.snapshot().words.find((item) => item.id === id && (this.mode !== 'box1' || item.box === 1));
      if (word) {
        this.currentTaskSignal.set('review');
        this.currentWordSignal.set(word);
        return;
      }
      this.nextTask(false);
      return;
    }
    const flushed = this.rechecks.takeNext({ flush: true });
    if (flushed) { this.openRecheck(flushed); return; }
    this.currentWordSignal.set(null);
  }

  private openRecheck(item: RecheckItem): void {
    this.currentRecheck = item;
    this.currentTaskSignal.set('recheck');
    this.currentWordSignal.set(item.word);
    this.remediationAttempt = RemediationAttempt.recheck({ wordId: item.word.id, accepted: item.word.accepted, recheckNumber: item.recheckNumber });
    this.remediationSignal.set(this.remediationAttempt.snapshot());
    this.canAdvanceSignal.set(false);
  }

  private async finish(): Promise<void> {
    this.activeSignal.set(false);
    this.completedSignal.set(true);
    const durationSeconds = Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
    if (this.backendSessionId) {
      await this.learningApi.completeSession(this.backendSessionId, {
        completedCount: this.answeredSignal(), correctCount: this.correctSignal(), wrongCount: this.wrongSignal(), durationSeconds,
      });
    }
    await this.store.update((state) => {
      const daily = todayRecord(state, localDay());
      daily.sessions += 1;
      daily.durationSeconds += durationSeconds;
    });
    this.backendSessionId = null;
  }

  async abandon(): Promise<void> {
    if (this.backendSessionId) await this.learningApi.abandonSession(this.backendSessionId, Math.max(0, Math.round((Date.now() - this.startedAt) / 1000)));
    this.speech.cancel();
    this.backendSessionId = null;
    this.queue = [];
    this.rechecks.clear();
    this.activeSignal.set(false);
    this.completedSignal.set(false);
    this.currentWordSignal.set(null);
    this.feedbackSignal.set(null);
    this.remediationSignal.set(null);
  }
}
