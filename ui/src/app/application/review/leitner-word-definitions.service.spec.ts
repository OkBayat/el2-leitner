import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SentencePracticeApiService } from '../../core/sentence-practice/sentence-practice-api.service';
import { LeitnerWordDefinitionsService } from './leitner-word-definitions.service';

describe('LeitnerWordDefinitionsService', () => {
	it('loads each represented house once and returns every requested definition', async () => {
		const getDeck = vi.fn(async (house: number) => ({
			practice: { mode: 'sentence' as const, house, retryGap: 3 },
			summary: { totalWords: 1, totalSentences: 0 },
			cards: [{
				id: `word-${house}`, term: `term-${house}`, accepted: [], box: house, mistakes: 0, sentences: [],
				definitions: [{ id: `definition-${house}`, text: ` definition ${house} `, languageCode: 'en', collectionTitle: 'Test' }],
			}],
		}));
		TestBed.configureTestingModule({ providers: [
			LeitnerWordDefinitionsService,
			{ provide: SentencePracticeApiService, useValue: { getDeck } },
		] });
		const service = TestBed.inject(LeitnerWordDefinitionsService);

		const definitions = await service.load([
			{ id: 'word-1', box: 1 },
			{ id: 'word-3', box: 3 },
			{ id: 'word-1', box: 1 },
		]);

		expect(getDeck).toHaveBeenCalledTimes(2);
		expect(getDeck).toHaveBeenCalledWith(1);
		expect(getDeck).toHaveBeenCalledWith(3);
		expect([...definitions]).toEqual([
			['word-1', 'definition 1'],
			['word-3', 'definition 3'],
		]);
	});

	it('fails closed when any requested word has no definition', async () => {
		TestBed.configureTestingModule({ providers: [
			LeitnerWordDefinitionsService,
			{ provide: SentencePracticeApiService, useValue: { getDeck: vi.fn().mockResolvedValue({ cards: [] }) } },
		] });

		await expect(TestBed.inject(LeitnerWordDefinitionsService).load([{ id: 'missing', box: 2 }]))
			.rejects.toThrow('Definitions are unavailable for 1 word.');
	});
});
