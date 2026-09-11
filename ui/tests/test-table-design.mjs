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
const wordsTemplate = read('src/app/features/words/words-page.component.html');
const house = read('src/app/features/leitner-house/leitner-house-page.component.ts');
const reports = read('src/app/features/reports/reports-page.component.ts');

assert.match(globalStyles, /@use '.\/styles\/table-design' as table-design/u, 'Table styling must have one shared global owner.');
assert.match(globalStyles, /@include table-design\.apply\(\)/u, 'Shared table styling must be applied from the global style composition root.');

for (const source of [`${words}\n${wordsTemplate}`, house, reports]) {
	assert.match(source, /MatTableModule/u, 'Every data-table feature must continue to use Angular Material table primitives.');
	assert.match(source, /<table mat-table/u, 'Every data-table feature must use the shared Material table surface.');
}

assert.match(tableStyles, /\.mat-mdc-cell\s*\{[^}]*border-bottom:\s*0;/u, 'Body rows must not have horizontal separators.');
assert.match(tableStyles, /\.mat-mdc-header-cell\s*\{[^}]*border-bottom:\s*0;/u, 'The compact table header must not add a heavy separator.');
assert.doesNotMatch(tableStyles, /--vocora-table-divider/u, 'Removed row separators must not leave an obsolete divider token behind.');
assert.match(tableStyles, /\.mat-mdc-row:hover,[\s\S]*\.mat-mdc-row:focus-within[\s\S]*background:\s*var\(--vocora-state-primary-surface\)/u, 'Rows must use the theme-aware primary state surface.');

assert.match(tableStyles, /\.mat-mdc-row \.row-actions[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;[\s\S]*visibility:\s*hidden/u, 'Row actions must be fully hidden before row interaction.');
assert.match(tableStyles, /\.mat-mdc-row:hover \.row-actions,[\s\S]*\.mat-mdc-row:focus-within \.row-actions[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;[\s\S]*visibility:\s*visible/u, 'Row actions must appear only while the row is hovered or keyboard-focused.');
assert.doesNotMatch(tableStyles, /@media\(hover:\s*none\)[\s\S]*\.row-actions[\s\S]*opacity:\s*1/u, 'There must not be a blanket rule that keeps row actions permanently visible.');

assert.deepEqual(
	[...wordsTemplate.matchAll(/matColumnDef="([^"]+)"/gu)].map((match) => match[1]),
	['term', 'box'],
	'Word Bank must expose only the Word and Box columns.',
);
assert.match(wordsTemplate, /\[routerLink\]="\['\/words', word\.id\]"/u, 'Word labels must link to their detail page.');
assert.match(wordsTemplate, />\s*\{\{ activatingId\(\) === word\.id \? 'Adding…' : 'Add to Leitner' \}\}\s*<\/button>/u, 'Unintroduced words must expose the Add to Leitner action.');
assert.doesNotMatch(wordsTemplate, />Previous<|>Next</u, 'Word Bank paging controls must stay removed.');
assert.match(words, /IntersectionObserver/u, 'Word Bank must lazy-load additional table rows.');
assert.match(tableStyles, /\.mat-mdc-header-cell[\s\S]*font-size:\s*12px;[\s\S]*font-weight:\s*600/u, 'Headers should remain compact rather than visually heavy.');

console.log('Google-like table design contract passed.');
