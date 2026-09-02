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
	/mat-form-field\.review-answer-field\s*\{[\s\S]*?--mat-form-field-container-height:\s*51px;[\s\S]*?--mat-form-field-container-vertical-padding:\s*14\.5px;/u,
	'The visible Material answer field must be 51px tall, 5px taller than the previous 46px version.',
);
assert.match(
	globalStyles,
	/mat-form-field\.review-answer-field \.mat-mdc-text-field-wrapper\s*\{[\s\S]*?height:\s*51px;/u,
	'The MDC outlined wrapper must enforce the 51px visible height.',
);
assert.match(
	globalStyles,
	/mat-form-field\.review-answer-field \.mat-mdc-form-field-infix\s*\{[\s\S]*?min-height:\s*51px;[\s\S]*?padding-top:\s*14\.5px;[\s\S]*?padding-bottom:\s*14\.5px;/u,
	'The Material infix must keep the answer vertically aligned within the 51px field.',
);
assert.match(
	globalStyles,
	/textarea\.review-answer-input\s*\{[\s\S]*?height:\s*22px!important;[\s\S]*?line-height:\s*22px!important;/u,
	'The one-line textarea content must remain single-line inside the 51px Material field.',
);
assert.doesNotMatch(globalStyles, /calc\(2rem - 5px\)/u, 'The ineffective 5px-only textarea reduction must not remain.');

console.log('Review answer textarea regression checks passed.');
