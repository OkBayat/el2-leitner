import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const wordsPage = fs.readFileSync(path.join(uiRoot, 'src/app/features/words/words-page.component.ts'), 'utf8');

assert.match(wordsPage, /<mat-label>Box<\/mat-label>/u, 'The words filter must use the standard Leitner Box terminology.');
assert.match(wordsPage, /<th mat-header-cell \*matHeaderCellDef>Box<\/th>/u, 'The status column must be labeled Box.');
assert.match(wordsPage, /word\.masteredAt \? 'mastered' : word\.box > 0 \? 'leitner' : 'not-introduced'/u, 'Mastered status must take precedence over active and not-introduced states.');
assert.match(wordsPage, /word\.masteredAt \? 'Mastered' : word\.box > 0 \? 'Box ' \+ word\.box : 'Not introduced'/u, 'Each status chip must expose the expected user-facing label.');
assert.match(wordsPage, /\.box-status-chip\[data-status='mastered'\]\{--status-tone:rgb\(52 168 83\)\}/u, 'Mastered words must use the green chip tone.');
assert.match(wordsPage, /\.box-status-chip\[data-status='leitner'\]\{--status-tone:rgb\(66 133 244\)\}/u, 'Words in the Leitner system must use the blue chip tone.');
assert.match(wordsPage, /\.box-status-chip\[data-status='not-introduced'\]\{--status-tone:rgb\(142 68 173\)\}/u, 'Not-introduced words must use the purple chip tone.');
assert.doesNotMatch(wordsPage, />House(?:\s|<)|House 1/u, 'The words page must not expose the non-standard House terminology.');

console.log('Words Box status chip contract passed.');
