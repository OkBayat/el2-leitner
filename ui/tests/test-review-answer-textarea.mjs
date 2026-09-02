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
	'The component must retain the baseline answer typography.',
);
assert.match(
	globalStyles,
	/mat-form-field\.review-answer-field\s*\{[\s\S]*?--mat-form-field-container-height:\s*46px;[\s\S]*?--mat-form-field-container-vertical-padding:\s*11px;/u,
	'The visible Material answer field must be 46px tall, exactly 10px below the default 56px height.',
);
assert.match(
	globalStyles,
	/mat-form-field\.review-answer-field \.mat-mdc-text-field-wrapper\s*\{[\s\S]*?height:\s*46px;/u,
	'The MDC outlined wrapper must enforce the 46px visible height rather than only shrinking the textarea content.',
);
assert.match(
	globalStyles,
	/mat-form-field\.review-answer-field \.mat-mdc-form-field-infix\s*\{[\s\S]*?min-height:\s*46px;[\s\S]*?padding-top:\s*11px;[\s\S]*?padding-bottom:\s*11px;/u,
	'The Material infix must align the label and text within the shorter field.',
);
assert.match(
	globalStyles,
	/textarea\.review-answer-input\s*\{[\s\S]*?height:\s*22px!important;[\s\S]*?line-height:\s*22px!important;/u,
	'The one-line textarea content must fit inside the 46px Material field without restoring multiline height.',
);
assert.doesNotMatch(globalStyles, /calc\(2rem - 5px\)/u, 'The ineffective 5px-only textarea reduction must not remain.');

console.log('Review answer textarea regression checks passed.');
