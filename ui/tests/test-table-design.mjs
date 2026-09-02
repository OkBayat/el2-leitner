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

assert.match(tableStyles, /\.mat-mdc-cell\s*\{[^}]*border-bottom:\s*0;/u, 'Body rows must not have horizontal separators.');
assert.match(tableStyles, /\.mat-mdc-header-cell\s*\{[^}]*border-bottom:\s*0;/u, 'The compact table header must not add a heavy separator.');
assert.doesNotMatch(tableStyles, /--vocora-table-divider/u, 'Removed row separators must not leave an obsolete divider token behind.');
assert.match(tableStyles, /\.mat-mdc-row:hover,[\s\S]*\.mat-mdc-row:focus-within[\s\S]*background:\s*rgb\(232 240 254\)/u, 'Rows must use the requested Google-like light blue hover color.');

assert.match(tableStyles, /\.mat-mdc-row \.row-actions[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;[\s\S]*visibility:\s*hidden/u, 'Row actions must be fully hidden before row interaction.');
assert.match(tableStyles, /\.mat-mdc-row:hover \.row-actions,[\s\S]*\.mat-mdc-row:focus-within \.row-actions[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;[\s\S]*visibility:\s*visible/u, 'Row actions must appear only while the row is hovered or keyboard-focused.');
assert.doesNotMatch(tableStyles, /@media\(hover:\s*none\)[\s\S]*\.row-actions[\s\S]*opacity:\s*1/u, 'There must not be a blanket rule that keeps row actions permanently visible.');

assert.match(words, /SpeechService/u, 'Word Bank must reuse the shared speech service.');
assert.match(words, /title="Play pronunciation"[\s\S]*\(click\)="speakWord\(word\)"/u, 'Pronunciation must be available as a row action.');
assert.match(words, /speakWord\(word: LearningWord\): void \{ this\.speech\.speak\(word\.term, this\.store\.snapshot\(\)\.settings\.voiceRate\); \}/u, 'Pronunciation must preserve the configured voice rate from the previous implementation.');
assert.match(words, /title="Edit"/u, 'Edit must remain a hover row action.');
assert.match(words, /title="Delete"/u, 'Delete must remain a hover row action.');

assert.doesNotMatch(words, /MatChipsModule|<mat-chip/u, 'Collection labels must no longer use Material chips.');
assert.match(words, /class="collection-actions"/u, 'Collection labels need a lightweight shared container.');
assert.match(words, /<button mat-button type="button" class="collection-label"/u, 'Collection labels must use simple Material text buttons.');
assert.match(tableStyles, /\.collection-label\.mat-mdc-button/u, 'Collection buttons must receive the minimal table treatment.');
assert.match(tableStyles, /\.mat-mdc-header-cell[\s\S]*font-size:\s*12px;[\s\S]*font-weight:\s*600/u, 'Headers should remain compact rather than visually heavy.');

console.log('Google-like table design contract passed.');
