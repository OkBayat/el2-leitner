import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VocabularyApiService } from '../../core/learning/vocabulary-api.service';
import { LeitnerWordDefinitionsService } from './leitner-word-definitions.service';

describe('LeitnerWordDefinitionsService', () => {
	it('loads every requested definition without requiring active Leitner houses', async () => {
		const sources = vi.fn().mockResolvedValue([
			{ vocabularyId: 'word-1', term: 'first', collections: [], definitions: [{ id: 'd1', text: ' first definition ', languageCode: 'en', collectionTitle: 'Test' }] },
			{ vocabularyId: 'word-3', term: 'third', collections: [], definitions: [{ id: 'd3', text: 'third definition', languageCode: 'en', collectionTitle: 'Test' }] },
		]);
		TestBed.configureTestingModule({ providers: [
			LeitnerWordDefinitionsService,
			{ provide: VocabularyApiService, useValue: { sources } },
		] });
		const service = TestBed.inject(LeitnerWordDefinitionsService);

		const definitions = await service.load([
			{ id: 'word-1' },
			{ id: 'word-3' },
			{ id: 'word-1' },
		]);

		expect(sources).toHaveBeenCalledWith(['word-1', 'word-3']);
		expect([...definitions]).toEqual([
			['word-1', 'first definition'],
			['word-3', 'third definition'],
		]);
	});

	it('fails closed when any requested word has no definition', async () => {
		TestBed.configureTestingModule({ providers: [
			LeitnerWordDefinitionsService,
			{ provide: VocabularyApiService, useValue: { sources: vi.fn().mockResolvedValue([]) } },
		] });

		await expect(TestBed.inject(LeitnerWordDefinitionsService).load([{ id: 'missing' }]))
			.rejects.toThrow('Definitions are unavailable for 1 word.');
	});
});
