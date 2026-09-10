import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { ReviewPersistenceService } from '../../core/persistence/review-persistence.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState, localDay } from '../../domain/learning/learning-rules';
import type { SlideExerciseResult } from '../../shared/slide-exercise';
import { LeitnerSlideSessionService } from './leitner-slide-session.service';

function result(itemId: string, answer: string, correct: boolean): SlideExerciseResult {
	return {
		slideId: `slide-${itemId}`,
		rootSlideId: `slide-${itemId}`,
		slideType: 'dictation',
		eventType: 'answered',
		itemId,
		data: { answer, correct },
	};
}

describe('LeitnerSlideSessionService', () => {
	it('promotes correct new spellings to House 2 and keeps mistakes in House 1', async () => {
		let revision = 4;
		let state = createFreshState([
			{ id: 'correct', term: 'persistent', accepted: ['persistent'], box: 1, due: localDay(), introducedOn: localDay() },
			{ id: 'wrong', term: 'progress', accepted: ['progress'], box: 1, due: localDay(), introducedOn: localDay() },
		]);
		const persist = vi.fn(async () => revision + 1);
		const completeSession = vi.fn().mockResolvedValue({});
		const store = {
			initialize: vi.fn(async () => state),
			snapshot: () => structuredClone(state),
			revision: () => revision,
			replaceLocal: (next: typeof state, nextRevision: number) => { state = next; revision = nextRevision; },
			update: vi.fn(async (mutate: (draft: typeof state) => void) => {
				const next = structuredClone(state);
				mutate(next);
				state = next;
				revision += 1;
				return state;
			}),
		};
		TestBed.configureTestingModule({ providers: [
			LeitnerSlideSessionService,
			{ provide: LearningStoreService, useValue: store },
			{ provide: ReviewPersistenceService, useValue: { persist } },
			{ provide: LearningApiService, useValue: {
				startSession: vi.fn().mockResolvedValue({ session: { id: 'session-1' } }),
				completeSession,
				abandonSession: vi.fn(),
			} },
		] });
		const service = TestBed.inject(LeitnerSlideSessionService);

		await service.start('new', ['correct', 'wrong']);
		await service.complete([
			result('correct', 'persistent', true),
			result('wrong', 'progres', false),
		]);

		expect(state.words.find((word) => word.id === 'correct')?.box).toBe(2);
		expect(state.words.find((word) => word.id === 'wrong')?.box).toBe(1);
		expect(state.history.map((event) => event.correct)).toEqual([true, false]);
		expect(persist).toHaveBeenCalledTimes(2);
		expect(completeSession).toHaveBeenCalledWith('session-1', expect.objectContaining({
			completedCount: 2,
			correctCount: 1,
			wrongCount: 1,
		}));
		expect(state.daily[localDay()].sessions).toBe(1);
	});

	it('applies daily-review answers to the current Leitner position exactly once', async () => {
		let revision = 2;
		let state = createFreshState([
			{ id: 'due', term: 'schedule', accepted: ['schedule'], box: 3, due: localDay(), introducedOn: '2026-09-01' },
		]);
		const persist = vi.fn(async () => revision + 1);
		const store = {
			initialize: vi.fn(async () => state), snapshot: () => structuredClone(state), revision: () => revision,
			replaceLocal: (next: typeof state, nextRevision: number) => { state = next; revision = nextRevision; },
			update: vi.fn(async (mutate: (draft: typeof state) => void) => { const next = structuredClone(state); mutate(next); state = next; revision += 1; return state; }),
		};
		TestBed.configureTestingModule({ providers: [
			LeitnerSlideSessionService,
			{ provide: LearningStoreService, useValue: store },
			{ provide: ReviewPersistenceService, useValue: { persist } },
			{ provide: LearningApiService, useValue: {
				startSession: vi.fn().mockResolvedValue({ session: { id: 'session-2' } }),
				completeSession: vi.fn().mockResolvedValue({}), abandonSession: vi.fn(),
			} },
		] });
		const service = TestBed.inject(LeitnerSlideSessionService);
		await service.start('review', ['due']);
		const results = [result('due', 'schedule', true)];
		await service.complete(results);
		await service.complete(results);

		expect(state.words[0].box).toBe(4);
		expect(persist).toHaveBeenCalledOnce();
	});
});
