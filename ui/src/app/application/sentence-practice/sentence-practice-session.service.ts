import { Injectable, computed, inject, signal } from '@angular/core';
import { LearningApiService, PracticeDailyStats } from '../../core/learning/learning-api.service';
import { SentencePracticeApiService } from '../../core/sentence-practice/sentence-practice-api.service';
import {
	SpeechService,
	type SpeechPlaybackMode,
} from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { localDay } from '../../domain/learning/learning-rules';
import {
	SentencePracticePrompt,
	SentencePracticeQueue,
	isAcceptedSentenceAnswer,
} from '../../domain/sentence-practice/sentence-practice';

export interface SentencePracticeFeedback {
	correct: boolean;
	submittedAnswer: string;
	correctAnswer: string;
}

@Injectable({ providedIn: 'root' })
export class SentencePracticeSessionService {
	private readonly api = inject(SentencePracticeApiService);
	private readonly learningApi = inject(LearningApiService);
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	private readonly currentPromptSignal = signal<SentencePracticePrompt | null>(null);
	private readonly activeSignal = signal(false);
	private readonly completedSignal = signal(false);
	private readonly feedbackSignal = signal<SentencePracticeFeedback | null>(null);
	private readonly answeredSignal = signal(0);
	private readonly correctSignal = signal(0);
	private readonly wrongSignal = signal(0);
	private readonly primaryAnsweredSignal = signal(0);
	private readonly initialCountSignal = signal(0);
	private readonly houseSignal = signal(1);
	private readonly playbackActiveSignal = signal(false);
	private readonly playbackCharIndexSignal = signal<number | null>(null);
	private queue: SentencePracticeQueue | null = null;
	private backendSessionId: string | null = null;
	private startedAt = 0;

	readonly currentPrompt = this.currentPromptSignal.asReadonly();
	readonly active = this.activeSignal.asReadonly();
	readonly completed = this.completedSignal.asReadonly();
	readonly feedback = this.feedbackSignal.asReadonly();
	readonly answered = this.answeredSignal.asReadonly();
	readonly correct = this.correctSignal.asReadonly();
	readonly wrong = this.wrongSignal.asReadonly();
	readonly initialCount = this.initialCountSignal.asReadonly();
	readonly primaryAnswered = this.primaryAnsweredSignal.asReadonly();
	readonly playbackActive = this.playbackActiveSignal.asReadonly();
	readonly playbackCharIndex = this.playbackCharIndexSignal.asReadonly();
	readonly freePractice = computed(() => this.houseSignal() === 1);
	readonly accuracy = computed(() => this.answeredSignal()
		? Math.round(this.correctSignal() / this.answeredSignal() * 100)
		: null);
	readonly progress = computed(() => this.freePractice()
		? 100
		: this.initialCountSignal()
			? Math.min(100, Math.round(this.primaryAnsweredSignal() / this.initialCountSignal() * 100))
			: 0);
	readonly canAdvance = computed(() => Boolean(this.feedbackSignal()));

	async start(house = 1): Promise<boolean> {
		this.stopPlayback();
		this.activeSignal.set(false);
		this.completedSignal.set(false);
		this.currentPromptSignal.set(null);
		this.feedbackSignal.set(null);
		await this.store.initialize();
		const deck = await this.api.getDeck(house);
		const cards = deck.cards.filter((card) => card.sentences.length > 0);
		if (!cards.length) return false;

		const session = await this.learningApi.startSession(`sentence-house-${house}`, cards.length);
		this.houseSignal.set(house);
		this.backendSessionId = session.session.id;
		this.startedAt = Date.now();
		this.queue = new SentencePracticeQueue(cards, deck.practice.retryGap, Math.random, house === 1);
		this.initialCountSignal.set(cards.length);
		this.primaryAnsweredSignal.set(0);
		this.answeredSignal.set(0);
		this.correctSignal.set(0);
		this.wrongSignal.set(0);
		this.feedbackSignal.set(null);
		this.completedSignal.set(false);
		this.activeSignal.set(true);
		this.currentPromptSignal.set(this.queue.next());
		return true;
	}

	pronounce(mode: SpeechPlaybackMode = 'normal'): boolean {
		const prompt = this.currentPromptSignal();
		if (!prompt) return false;
		const sentenceText = prompt.sentence.text.trim();
		this.resetPlaybackState();
		const observer = {
				onStart: () => {
					if (this.currentPromptSignal() !== prompt) return;
					this.playbackActiveSignal.set(true);
					this.playbackCharIndexSignal.set(null);
				},
				onWordBoundary: (charIndex: number) => {
					if (this.currentPromptSignal() !== prompt) return;
					this.playbackActiveSignal.set(true);
					this.playbackCharIndexSignal.set(charIndex);
				},
				onEnd: () => {
					if (this.currentPromptSignal() !== prompt) return;
					this.playbackActiveSignal.set(false);
					this.playbackCharIndexSignal.set(sentenceText.length);
				},
			};
		const text = sentenceText || prompt.card.term;
		const rate = this.store.snapshot().settings.voiceRate;
		const started =
			mode === 'normal'
				? this.speech.speak(text, rate, observer)
				: this.speech.speak(text, rate, observer, undefined, mode);
		if (!started) this.resetPlaybackState();
		return started;
	}

	async submit(answer: string): Promise<void> {
		const prompt = this.currentPromptSignal();
		if (!prompt || !this.activeSignal() || this.feedbackSignal() || !this.backendSessionId) return;
		const accepted = prompt.card.accepted.length ? prompt.card.accepted : [prompt.card.term];
		const correct = isAcceptedSentenceAnswer(answer, accepted);
		const attempt = await this.learningApi.recordSessionAttempt(this.backendSessionId, {
			day: localDay(),
			correct,
		});
		this.applyDailyStats(attempt.daily);

		this.answeredSignal.update((value) => value + 1);
		if (prompt.primary) this.primaryAnsweredSignal.update((value) => value + 1);
		if (correct) this.correctSignal.update((value) => value + 1);
		else {
			this.wrongSignal.update((value) => value + 1);
			this.queue?.scheduleRetry(prompt);
		}
		this.feedbackSignal.set({
			correct,
			submittedAnswer: answer,
			correctAnswer: prompt.card.term,
		});
	}

	async next(): Promise<void> {
		if (!this.feedbackSignal() || !this.activeSignal()) return;
		this.stopPlayback();
		this.feedbackSignal.set(null);
		const prompt = this.queue?.next() ?? null;
		this.currentPromptSignal.set(prompt);
		if (!prompt) await this.finish();
	}

	async abandon(): Promise<void> {
		try {
			if (this.backendSessionId) {
				await this.learningApi.abandonSession(this.backendSessionId, this.durationSeconds());
			}
		} finally {
			this.stopPlayback();
			this.backendSessionId = null;
			this.queue?.clear();
			this.queue = null;
			this.activeSignal.set(false);
			this.completedSignal.set(false);
			this.currentPromptSignal.set(null);
			this.feedbackSignal.set(null);
		}
	}

	async restart(): Promise<boolean> {
		return this.start(this.houseSignal());
	}

	private applyDailyStats(daily: PracticeDailyStats): void {
		const state = this.store.snapshot();
		state.daily[daily.day] = {
			attempts: daily.attempts,
			correct: daily.correct,
			wrong: daily.wrong,
			newAdded: daily.newAdded,
			sessions: daily.sessions,
			durationSeconds: daily.durationSeconds,
		};
		this.store.replaceLocal(state);
	}

	private async finish(): Promise<void> {
		this.stopPlayback();
		this.activeSignal.set(false);
		this.completedSignal.set(true);
		this.currentPromptSignal.set(null);
		if (this.backendSessionId) {
			await this.learningApi.completeSession(this.backendSessionId, {
				completedCount: this.answeredSignal(),
				correctCount: this.correctSignal(),
				wrongCount: this.wrongSignal(),
				durationSeconds: this.durationSeconds(),
			});
		}
		this.backendSessionId = null;
		this.queue = null;
	}

	private stopPlayback(): void {
		this.speech.cancel();
		this.resetPlaybackState();
	}

	private resetPlaybackState(): void {
		this.playbackActiveSignal.set(false);
		this.playbackCharIndexSignal.set(null);
	}

	private durationSeconds(): number {
		return Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
	}
}
