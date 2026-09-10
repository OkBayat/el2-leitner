import { Injectable, inject } from '@angular/core';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { ReviewPersistenceService } from '../../core/persistence/review-persistence.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { applyReview, localDay, todayRecord } from '../../domain/learning/learning-rules';
import type { ReviewCommand, ReviewMode } from '../../domain/learning/models';
import type { SlideExerciseResult } from '../../shared/slide-exercise';

type SlideSessionMode = Extract<ReviewMode, 'new' | 'review'>;

interface DictationResult {
	readonly itemId: string;
	readonly answer: string;
	readonly correct: boolean;
}

function dictationResult(result: SlideExerciseResult): DictationResult | null {
	if (result.slideType !== 'dictation' || !result.itemId || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return null;
	const data = result.data as Record<string, unknown>;
	if (typeof data['answer'] !== 'string' || typeof data['correct'] !== 'boolean') return null;
	return { itemId: result.itemId, answer: data['answer'], correct: data['correct'] };
}

@Injectable({ providedIn: 'root' })
export class LeitnerSlideSessionService {
	private readonly learningApi = inject(LearningApiService);
	private readonly persistence = inject(ReviewPersistenceService);
	private readonly store = inject(LearningStoreService);
	private sessionId: string | null = null;
	private mode: SlideSessionMode = 'review';
	private plannedIds: readonly string[] = [];
	private startedAt = 0;
	private readonly recorded = new Map<string, boolean>();

	async start(mode: SlideSessionMode, wordIds: readonly string[]): Promise<void> {
		await this.store.initialize();
		if (this.sessionId) await this.abandon();
		const plannedIds = [...new Set(wordIds.map((id) => id.trim()).filter(Boolean))];
		if (!plannedIds.length) throw new Error('This spelling practice has no words.');
		const response = await this.learningApi.startSession(mode, plannedIds.length);
		this.sessionId = response.session.id;
		this.mode = mode;
		this.plannedIds = plannedIds;
		this.startedAt = Date.now();
		this.recorded.clear();
	}

	async complete(results: readonly SlideExerciseResult[]): Promise<void> {
		const sessionId = this.sessionId;
		if (!sessionId) return;
		const resultById = new Map(results.map(dictationResult).filter((result): result is DictationResult => result !== null).map((result) => [result.itemId, result]));
		if (resultById.size !== this.plannedIds.length || this.plannedIds.some((id) => !resultById.has(id))) {
			throw new Error('Answer every spelling slide before finishing.');
		}

		for (const itemId of this.plannedIds) {
			if (this.recorded.has(itemId)) continue;
			const result = resultById.get(itemId)!;
			const transition = applyReview(this.store.snapshot(), itemId, result.answer, this.mode, new Date(), !result.correct);
			const command: ReviewCommand = {
				revision: this.store.revision(),
				practiceSessionId: sessionId,
				word: {
					id: transition.word.id,
					box: transition.word.box,
					due: transition.word.due,
					attempts: transition.word.attempts,
					correct: transition.word.correct,
					mistakes: transition.word.mistakes,
					currentStreak: transition.word.currentStreak,
					introducedOn: transition.word.introducedOn,
					addedSource: transition.word.addedSource,
					lastReviewed: transition.word.lastReviewed,
					lastPromotedDay: transition.word.lastPromotedDay,
					blockedUntil: transition.word.blockedUntil,
					masteredAt: transition.word.masteredAt,
				},
				event: transition.event,
				daily: transition.daily,
			};
			const revision = await this.persistence.persist(command);
			this.store.replaceLocal(transition.state, revision);
			this.recorded.set(itemId, transition.event.correct);
		}

		const durationSeconds = this.durationSeconds();
		const outcomes = [...this.recorded.values()];
		await this.learningApi.completeSession(sessionId, {
			completedCount: outcomes.length,
			correctCount: outcomes.filter(Boolean).length,
			wrongCount: outcomes.filter((correct) => !correct).length,
			durationSeconds,
		});
		await this.store.update((state) => {
			const daily = todayRecord(state, localDay());
			daily.sessions += 1;
			daily.durationSeconds += durationSeconds;
		});
		this.clear();
	}

	async abandon(): Promise<void> {
		const sessionId = this.sessionId;
		try {
			if (sessionId) await this.learningApi.abandonSession(sessionId, this.durationSeconds());
		} finally {
			this.clear();
		}
	}

	private durationSeconds(): number {
		return Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
	}

	private clear(): void {
		this.sessionId = null;
		this.plannedIds = [];
		this.startedAt = 0;
		this.recorded.clear();
	}
}
