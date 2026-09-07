import { Injectable, inject } from '@angular/core';
import { ReviewSessionService } from '../../../../application/review/review-session.service';
import { CollectionLearningPathApiService } from '../../../../core/collection-learning-path/collection-learning-path-api.service';
import { parseVocabularySpellingStart, type VocabularySpellingItem, type VocabularySpellingScope } from '../../../../domain/collection-learning-path/vocabulary-spelling-practice';
import type { SlideExerciseResult } from '../../../../shared/slide-exercise';
import type { CompletedLearningPathExerciseOutcome } from '../../../../domain/collection-learning-path/learning-path';
import type { ExerciseContext } from '../exercise-runtime/exercise-contracts';

function dictationAnswer(result: SlideExerciseResult): string | null {
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return null;
  const answer = String((result.data as Record<string, unknown>)['answer'] ?? '').trim();
  return answer || null;
}

@Injectable()
export class SlideBaseExerciseSessionService {
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly reviewSession = inject(ReviewSessionService);
  private scope: VocabularySpellingScope | null = null;
  private items: readonly VocabularySpellingItem[] = [];
  private started = false;
  private completionCursor = 0;

  async startVocabularySpelling(
    context: ExerciseContext,
    scope: VocabularySpellingScope,
  ): Promise<readonly VocabularySpellingItem[]> {
    if (this.started) throw new Error('This spelling attempt has already started.');
    const response = parseVocabularySpellingStart(await this.api.commandStartVocabularySpelling(
      context.pathId,
      context.lessonId,
      context.exerciseId,
      scope,
    ));
    this.scope = response.payload.scope;
    this.items = response.payload.items;
    this.completionCursor = 0;
    if (response.session) {
      const opened = await this.reviewSession.openLearningPathSpelling(
        this.items.map((item) => item.id),
        response.session.id,
      );
      if (!opened) throw new Error('House 1 changed while this exercise was opening. Reopen it to use the latest words.');
    }
    this.started = true;
    return this.items;
  }

  async complete(
    completionPolicy: string,
    results: readonly SlideExerciseResult[],
  ): Promise<CompletedLearningPathExerciseOutcome> {
    if (completionPolicy !== 'vocabulary-spelling' || !this.started || !this.scope) {
      throw new Error('Slide exercise completion is unavailable.');
    }
    if (!this.items.length) return { kind: 'completed', evidence: { scope: this.scope } };
    const answersByItem = new Map<string, string>();
    for (const result of results) {
      if (!result.itemId || answersByItem.has(result.itemId)) continue;
      const answer = dictationAnswer(result);
      if (answer) answersByItem.set(result.itemId, answer);
    }
    if (answersByItem.size !== this.items.length) throw new Error('Answer every spelling word before finishing.');
    while (this.completionCursor < this.items.length) {
      const item = this.items[this.completionCursor];
      const answer = answersByItem.get(item.id);
      if (!answer || this.reviewSession.currentWord()?.id !== item.id) {
        throw new Error('Spelling session order changed. Reopen the exercise.');
      }
      await this.reviewSession.submit(answer);
      this.completionCursor += 1;
      await this.reviewSession.next();
    }
    if (!this.reviewSession.completedSessionId() && this.reviewSession.active()) {
      await this.reviewSession.next();
    }
    const sessionId = this.reviewSession.completedSessionId();
    if (!sessionId) throw new Error('Spelling completion evidence is unavailable.');
    return { kind: 'completed', evidence: { scope: this.scope, sessionId } };
  }

  async abandon(): Promise<void> {
    if (this.reviewSession.active()) await this.reviewSession.abandon();
  }
}
