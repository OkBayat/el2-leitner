import {describe, expect, it, vi} from 'vitest';
import {buildHouseOneEntries, buildHouseOneExport, copyTextToClipboard, type HouseOneExportWord} from './house-one-export';

function word(overrides: Partial<HouseOneExportWord> = {}): HouseOneExportWord {
	return {
		box: 1,
		term: 'example',
		mistakes: 0,
		number: 1,
		...overrides,
	};
}

describe('House 1 clipboard export', () => {
	it('exports only House 1 words in the legacy mistake-first order', () => {
		const words = [
			word({term: 'third', mistakes: 1, number: 30}),
			word({term: 'first', mistakes: 4, number: 20}),
			word({term: 'second', mistakes: 4, number: 10}),
			word({term: 'not-house-one', box: 2, mistakes: 99, number: 1}),
		];

		expect(buildHouseOneEntries(words)).toEqual([
			{term: 'second', mistakes: 4, number: 10},
			{term: 'first', mistakes: 4, number: 20},
			{term: 'third', mistakes: 1, number: 30},
		]);
		expect(buildHouseOneExport(words)).toBe('second — 4\nfirst — 4\nthird — 1');
	});

	it('normalizes whitespace and invalid mistake counts before copying', () => {
		const words = [
			word({term: '  multiple   words  ', mistakes: -3}),
			word({term: '   ', mistakes: 5, number: 2}),
		];

		expect(buildHouseOneExport(words)).toBe('multiple words — 0');
	});

	it('uses the browser clipboard API when it is available', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const copied = await copyTextToClipboard('alpha — 2', {
			clipboard: {writeText},
			document: null,
		});

		expect(copied).toBe(true);
		expect(writeText).toHaveBeenCalledOnce();
		expect(writeText).toHaveBeenCalledWith('alpha — 2');
	});

	it('does not attempt to copy an empty export', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const copied = await copyTextToClipboard('', {
			clipboard: {writeText},
			document: null,
		});

		expect(copied).toBe(false);
		expect(writeText).not.toHaveBeenCalled();
	});
});
