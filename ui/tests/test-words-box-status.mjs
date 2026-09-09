import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const wordsPage = read('src/app/features/words/words-page.component.ts');
const wordsTemplate = read('src/app/features/words/words-page.component.html');
const wordsStyles = read('src/app/features/words/words-page.component.scss');

assert.match(wordsTemplate, /<mat-label>Box<\/mat-label>/u, 'The words filter must use the standard Leitner Box terminology.');
assert.match(wordsTemplate, /<th mat-header-cell \*matHeaderCellDef>Box<\/th>/u, 'The status column must be labeled Box.');
assert.ok(
	wordsTemplate.indexOf('@if (word.masteredAt)') < wordsTemplate.indexOf('@else if (word.box > 0)'),
	'Mastered status must take precedence over active Leitner status.',
);
assert.match(wordsTemplate, />Mastered<\/span>/u, 'Mastered words must expose their status label.');
assert.match(wordsTemplate, />Box \{\{ word\.box \}\}<\/span>/u, 'Active words must expose their Leitner box number.');
assert.match(wordsTemplate, /'Add to Leitner'/u, 'Unintroduced words must expose the requested Leitner action.');
assert.doesNotMatch(wordsTemplate, /Not introduced/u, 'The obsolete Not introduced label must stay removed.');
assert.match(wordsStyles, /data-status='mastered'[\s\S]*var\(--vocora-mastered\)/u, 'Mastered words must use the semantic mastered token.');
assert.match(wordsStyles, /data-status='leitner'[\s\S]*var\(--vocora-leitner-active\)/u, 'Words in Leitner must use the semantic active token.');
assert.doesNotMatch(`${wordsPage}\n${wordsTemplate}`, />House(?:\s|<)|House 1/u, 'The words page must not expose the non-standard House terminology.');

console.log('Words Box status chip contract passed.');
