import { Injectable, inject } from '@angular/core';
import { LearningApiService, type PracticeDailyStats } from '../../core/learning/learning-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { localDay } from '../../domain/learning/learning-rules';
import type { SlideExerciseResult } from '../../shared/slide-exercise';
import type { PracticeWordsMode } from './practice-words-slide-builder.service';

@Injectable({ providedIn: 'root' })
export class PracticeWordsSessionService {
  private readonly learningApi = inject(LearningApiService);
  private readonly store = inject(LearningStoreService);
  private sessionId: string | null = null;
  private startedAt = 0;
  private readonly recordedSlideIds = new Set<string>();

  async start(mode: PracticeWordsMode, plannedCount: number): Promise<void> {
    await this.store.initialize();
    if (this.sessionId) await this.abandon();
    const response = await this.learningApi.startSession(`practice-words.${mode}`, plannedCount);
    this.sessionId = response.session.id;
    this.startedAt = Date.now();
    this.recordedSlideIds.clear();
  }

  async complete(results: readonly SlideExerciseResult[]): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) return;
    const scored = results.filter((result) => this.correctness(result) !== null);
    for (const result of scored) {
      if (this.recordedSlideIds.has(result.slideId)) continue;
      const response = await this.learningApi.recordSessionAttempt(sessionId, {
        day: localDay(),
        correct: this.correctness(result)!,
      });
      this.applyDailyStats(response.daily);
      this.recordedSlideIds.add(result.slideId);
    }
    await this.learningApi.completeSession(sessionId, {
      completedCount: scored.length,
      correctCount: scored.filter((result) => this.correctness(result) === true).length,
      wrongCount: scored.filter((result) => this.correctness(result) === false).length,
      durationSeconds: this.durationSeconds(),
    });
    this.clear();
  }

  async abandon(): Promise<void> {
    const sessionId = this.sessionId;
    try {
      if (sessionId) {
        await this.learningApi.abandonSession(sessionId, this.durationSeconds());
      }
    } finally {
      this.clear();
    }
  }

  private correctness(result: SlideExerciseResult): boolean | null {
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return null;
    const correct = (result.data as { correct?: unknown }).correct;
    return typeof correct === 'boolean' ? correct : null;
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

  private durationSeconds(): number {
    return Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
  }

  private clear(): void {
    this.sessionId = null;
    this.startedAt = 0;
    this.recordedSlideIds.clear();
  }
}
