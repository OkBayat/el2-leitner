import type {LearningWord} from '../../domain/learning/models';

export type HouseOneExportWord = Pick<LearningWord, 'box' | 'term' | 'mistakes' | 'number'>;

export interface HouseOneExportEntry {
	term: string;
	mistakes: number;
	number: number;
}

export interface ClipboardWriter {
	writeText(value: string): Promise<void>;
}

function normalizedMistakes(word: HouseOneExportWord): number {
	const value = Number(word.mistakes);
	return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function normalizedNumber(word: HouseOneExportWord): number {
	const value = Number(word.number);
	return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizedTerm(word: HouseOneExportWord): string {
	return String(word.term || '').replace(/\s+/g, ' ').trim();
}

export function buildHouseOneEntries(words: readonly HouseOneExportWord[]): HouseOneExportEntry[] {
	return words
		.filter((word) => Number(word.box) === 1)
		.map((word) => ({
			term: normalizedTerm(word),
			mistakes: normalizedMistakes(word),
			number: normalizedNumber(word),
		}))
		.filter((entry) => entry.term)
		.sort((a, b) => b.mistakes - a.mistakes || a.number - b.number || a.term.localeCompare(b.term, 'en', {sensitivity: 'base'}));
}

export function buildHouseOneExport(words: readonly HouseOneExportWord[]): string {
	return buildHouseOneEntries(words)
		.map((entry) => `${entry.term} — ${entry.mistakes}`)
		.join('\n');
}

export async function copyTextToClipboard(
	text: string,
	options: {clipboard?: ClipboardWriter | null; document?: Document | null} = {},
): Promise<boolean> {
	const value = String(text || '');
	if (!value) return false;

	const clipboard = options.clipboard === undefined ? globalThis.navigator?.clipboard : options.clipboard;
	if (clipboard && typeof clipboard.writeText === 'function') {
		try {
			await clipboard.writeText(value);
			return true;
		} catch {
			// Fall through to the selection-based browser fallback.
		}
	}

	const doc = options.document === undefined ? globalThis.document : options.document;
	if (!doc?.body || typeof doc.createElement !== 'function' || typeof doc.execCommand !== 'function') return false;

	const textarea = doc.createElement('textarea');
	textarea.value = value;
	textarea.dir = 'ltr';
	textarea.setAttribute('readonly', '');
	textarea.setAttribute('aria-hidden', 'true');
	textarea.style.position = 'fixed';
	textarea.style.inset = '-9999px auto auto -9999px';
	textarea.style.opacity = '0';
	doc.body.appendChild(textarea);
	textarea.select();
	textarea.setSelectionRange(0, value.length);

	try {
		return Boolean(doc.execCommand('copy'));
	} catch {
		return false;
	} finally {
		textarea.remove();
	}
}
