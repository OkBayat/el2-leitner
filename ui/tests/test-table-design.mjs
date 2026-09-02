import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');

const globalStyles = read('src/styles.scss');
const tableStyles = read('src/styles/_table-design.scss');
const words = read('src/app/features/words/words-page.component.ts');
const house = read('src/app/features/leitner-house/leitner-house-page.component.ts');
const reports = read('src/app/features/reports/reports-page.component.ts');

assert.match(globalStyles, /@use '.\/styles\/table-design' as table-design/u, 'Table styling must have one shared global owner.');
assert.match(globalStyles, /@include table-design\.apply\(\)/u, 'Shared table styling must be applied from the global style composition root.');

for (const source of [words, house, reports]) {
	assert.match(source, /MatTableModule/u, 'Every data-table feature must continue to use Angular Material table primitives.');
	assert.match(source, /<table mat-table/u, 'Every data-table feature must use the shared Material table surface.');
}

assert.match(tableStyles, /\.mat-mdc-row:hover,[\s\S]*\.mat-mdc-row:focus-within[\s\S]*background:\s*var\(--mat-sys-surface-container-low\)/u, 'Rows need a subtle hover/focus background.');
assert.match(tableStyles, /\.mat-mdc-row \.row-actions[\s\S]*opacity:\s*0;[\s\S]*visibility:\s*hidden/u, 'Desktop row actions must stay visually quiet until interaction.');
assert.match(tableStyles, /\.mat-mdc-row:hover \.row-actions,[\s\S]*\.mat-mdc-row:focus-within \.row-actions[\s\S]*opacity:\s*1/u, 'Row actions must appear on hover and keyboard focus.');
assert.match(tableStyles, /@media\(hover:\s*none\),\s*\(pointer:\s*coarse\)[\s\S]*\.row-actions[\s\S]*opacity:\s*1/u, 'Touch users must never lose access to row actions.');
assert.match(tableStyles, /--mdc-chip-outline-color:\s*color-mix\(in srgb, var\(--mat-sys-outline-variant\) 52%, transparent\)/u, 'Table chips need a softer outline than the previous default.');
assert.match(tableStyles, /--vocora-table-divider:\s*color-mix\(in srgb, var\(--mat-sys-outline-variant\) 55%, transparent\)/u, 'Table separators should be visually lighter.');
assert.match(tableStyles, /\.mat-mdc-header-cell[\s\S]*font-size:\s*12px;[\s\S]*font-weight:\s*600/u, 'Headers should remain compact rather than visually heavy.');
assert.match(words, /class="row-actions"/u, 'Word Bank actions must participate in the shared hover-only action treatment.');
assert.match(words, /<mat-chip/u, 'Word Bank collection chips must participate in the shared soft-chip treatment.');

console.log('Minimal table design contract passed.');
