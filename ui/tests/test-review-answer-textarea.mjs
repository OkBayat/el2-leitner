import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const template = fs.readFileSync(path.join(uiRoot, 'src/app/features/review/review-page.component.html'), 'utf8');
const styles = fs.readFileSync(path.join(uiRoot, 'src/app/features/review/review-page.component.scss'), 'utf8');
const globalStyles = fs.readFileSync(path.join(uiRoot, 'src/styles.scss'), 'utf8');

assert.match(
	template,
	/<textarea[\s\S]*?data-testid="review-answer-input"[\s\S]*?<\/textarea>/u,
	'The shared review answer control must use a textarea so Android does not show the autofill accessory row.',
);
assert.doesNotMatch(
	template,
	/<input[^>]*data-testid="review-answer-input"/u,
	'The review answer control must not regress to an input element.',
);
assert.match(template, /rows="1"/u, 'The textarea must stay visually single-line.');
assert.match(template, /wrap="off"/u, 'Long spellings must not wrap onto a second line.');
assert.match(template, /enterkeyhint="go"/u, 'Mobile keyboards should keep a submit-style Enter key.');
assert.match(template, /aria-multiline="false"/u, 'Assistive technology should treat the answer as a single-line response.');
assert.match(
	template,
	/style="resize: none; overflow: hidden; white-space: nowrap;"/u,
	'The textarea must not expose multiline resize/overflow behavior.',
);
assert.match(
	template,
	/\(keydown\.enter\)="\$event\.preventDefault\(\); field\.readOnly \? next\(\) : submitAnswer\(\)"/u,
	'Enter must submit editable answers and continue from readonly feedback without inserting a newline.',
);
assert.match(
	styles,
	/\.review-answer-input\s*\{[\s\S]*?height:\s*2rem!important;[\s\S]*?font-size:\s*1\.2rem!important;/u,
	'The component must retain the baseline input height and typography.',
);
assert.match(
	globalStyles,
	/textarea\.review-answer-input\s*\{[\s\S]*?height:\s*calc\(2rem - 5px\)!important;/u,
	'The textarea presentation must be exactly 5px shorter than the baseline input height.',
);

console.log('Review answer textarea regression checks passed.');
