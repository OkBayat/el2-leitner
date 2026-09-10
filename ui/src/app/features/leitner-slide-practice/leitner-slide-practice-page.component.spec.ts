import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LeitnerDictationSlideBuilderService } from '../../application/review/leitner-dictation-slide-builder.service';
import { LeitnerSlideSessionService } from '../../application/review/leitner-slide-session.service';
import { LeitnerWordDefinitionsService } from '../../application/review/leitner-word-definitions.service';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState, localDay } from '../../domain/learning/learning-rules';
import { LeitnerSlidePracticePageComponent } from './leitner-slide-practice-page.component';

async function setup(mode: 'add-new' | 'daily-review') {
	const state = createFreshState([
		{ id: 'unseen-1', term: 'first', accepted: ['first'] },
		{ id: 'unseen-2', term: 'second', accepted: ['second'] },
		{ id: 'due', term: 'due', accepted: ['due'], box: 2, due: localDay(), introducedOn: '2026-09-01' },
	]);
	state.settings.dailyNew = 2;
	const generated = (mode === 'add-new' ? ['unseen-1', 'unseen-2'] : ['due']).map((itemId) => ({
		id: `generated-${itemId}`, rootSlideId: `generated-${itemId}`, itemId, type: 'message', data: { title: 'Generated spelling' },
	}));
	const activateWords = vi.fn().mockResolvedValue({
		activated: state.words.slice(0, 2).map((word) => ({ ...word, box: 1, introducedOn: localDay(), due: localDay() })),
	});
	const build = vi.fn().mockReturnValue(generated);
	const start = vi.fn().mockResolvedValue(undefined);
	const record = vi.fn().mockResolvedValue(undefined);
	const complete = vi.fn().mockResolvedValue(undefined);
	const abandon = vi.fn().mockResolvedValue(undefined);
	const definitions = new Map(mode === 'add-new'
		? [['unseen-1', 'first definition'], ['unseen-2', 'second definition']]
		: [['due', 'due definition']]);
	const loadDefinitions = vi.fn().mockResolvedValue(definitions);
	const navigateByUrl = vi.fn().mockResolvedValue(true);
	await TestBed.configureTestingModule({
		imports: [LeitnerSlidePracticePageComponent],
		providers: [
			{ provide: ActivatedRoute, useValue: { snapshot: { data: { practiceMode: mode } } } },
			{ provide: Router, useValue: { navigateByUrl } },
			{ provide: CollectionLearningPathApiService, useValue: {} },
			{ provide: LearningStoreService, useValue: { state: signal(state), initialize: vi.fn().mockResolvedValue(state), snapshot: () => structuredClone(state), activateWords } },
			{ provide: LeitnerDictationSlideBuilderService, useValue: { build } },
			{ provide: LeitnerWordDefinitionsService, useValue: { load: loadDefinitions } },
			{ provide: LeitnerSlideSessionService, useValue: { start, record, complete, abandon } },
		],
	}).compileComponents();
	const fixture = TestBed.createComponent(LeitnerSlidePracticePageComponent);
	fixture.detectChanges();
	await fixture.whenStable();
	await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
	fixture.detectChanges();
	return { fixture, generated, activateWords, build, start, record, complete, definitions, loadDefinitions, navigateByUrl };
}

describe('LeitnerSlidePracticePageComponent', () => {
	it('uses the saved daily-new setting in a numeric setup slide and expands the requested new words', async () => {
		const { fixture, generated, activateWords, build, start, record, definitions, loadDefinitions } = await setup('add-new');
		const context = fixture.componentInstance.exerciseContext();
		expect(context?.config['slides']).toMatchObject([
			{
				id: 'word-count',
				type: 'number-input',
				data: { min: 1, max: 2, step: 1, initialValue: 2, expansionId: 'new-word-practice' },
				chrome: { header: { progress: null } },
			},
			{ id: 'finish', type: 'summary', terminal: true },
		]);

		const expanded = await context?.numberInputExpansion?.({ expansionId: 'new-word-practice', slideId: 'word-count', value: 2 });
		expect(activateWords).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ id: 'unseen-1' }),
			expect.objectContaining({ id: 'unseen-2' }),
		]), 'home-selection');
		expect(loadDefinitions).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ id: 'unseen-1', box: 1 }),
			expect.objectContaining({ id: 'unseen-2', box: 1 }),
		]));
		expect(build).toHaveBeenCalledWith('word-count', expect.any(Array), definitions);
		expect(start).toHaveBeenCalledWith('new', ['unseen-1', 'unseen-2']);
		expect(expanded?.slides).toEqual(generated);
		await context?.slideResult?.({
			slideId: 'generated-unseen-1', rootSlideId: 'generated-unseen-1', slideType: 'dictation', eventType: 'answered', itemId: 'unseen-1', data: { answer: 'first', correct: true },
		});
		expect(record).toHaveBeenCalledOnce();
	});

	it('opens today due words directly as spelling slides followed by a final summary', async () => {
		const { fixture, generated, build, start, complete, definitions, loadDefinitions, navigateByUrl } = await setup('daily-review');
		const context = fixture.componentInstance.exerciseContext();
		expect(loadDefinitions).toHaveBeenCalledWith([expect.objectContaining({ id: 'due', box: 2 })]);
		expect(build).toHaveBeenCalledWith('daily-review', [expect.objectContaining({ id: 'due' })], definitions);
		expect(start).toHaveBeenCalledWith('review', ['due']);
		expect(context?.config['slides']).toEqual([
			...generated,
			expect.objectContaining({ id: 'finish', type: 'summary', terminal: true }),
		]);

		await context?.sequenceCompletion?.([]);
		expect(complete).toHaveBeenCalledWith();
		await fixture.componentInstance.onOutcome({ kind: 'completed', evidence: { schemaVersion: 1, results: [] } });
		expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
	});
});
