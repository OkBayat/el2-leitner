import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const libraryRoot = join(uiRoot, 'src/app/shared/slide-exercise/library');
const componentTypes = [
	'teaching-card',
	'choice',
	'truth',
	'matching',
	'classification',
	'ordering',
	'cloze',
	'structured-completion',
	'short-answer',
	'word-formation',
	'error-correction',
	'rewrite',
	'pronunciation',
	'dictation',
	'speaking-response',
	'writing-response',
];
const barrelPath = join(libraryRoot, 'slide-library.components.ts');
const barrel = readFileSync(barrelPath, 'utf8');
const sharedStyles = readFileSync(
	join(libraryRoot, 'slide-library.component.scss'),
	'utf8',
);
const layoutStyles = readFileSync(
	join(uiRoot, 'src/app/shared/slide-exercise/slide-exercise.component.scss'),
	'utf8',
);
const clozeTemplate = readFileSync(
	join(libraryRoot, 'components', 'cloze', 'cloze-slide.component.html'),
	'utf8',
);

assert.doesNotMatch(
	barrel,
	/@Component|template\s*:/u,
	'The slide component barrel must not contain implementations or templates.',
);

for (const type of componentTypes) {
	const componentPath = join(
		libraryRoot,
		'components',
		type,
		`${type}-slide.component.ts`,
	);
	assert.ok(existsSync(componentPath), `Missing ${type} slide component.`);
	const source = readFileSync(componentPath, 'utf8');
	assert.doesNotMatch(
		source,
		/\btemplate\s*:/u,
		`${type} must use an external template.`,
	);
	const templateUrl = source.match(/\btemplateUrl:\s*['"]([^'"]+)['"]/u)?.[1];
	assert.ok(templateUrl, `${type} must declare templateUrl.`);
	assert.equal(
		templateUrl,
		`./${type}-slide.component.html`,
		`${type} must own its external template.`,
	);
	assert.ok(
		existsSync(resolve(dirname(componentPath), templateUrl)),
		`${type} templateUrl must resolve to an HTML file.`,
	);
	assert.match(
		barrel,
		new RegExp(`components/${type}/${type}-slide\\.component`, 'u'),
		`${type} must remain exported from the public component barrel.`,
	);
}

assert.match(
	sharedStyles,
	/\[data-state='selected'\][\s\S]*var\(--vocora-information-border\)/u,
);
assert.match(
	sharedStyles,
	/\[data-state='selected'\][\s\S]*var\(--vocora-information-surface\)/u,
);
assert.match(
	sharedStyles,
	/\[data-state='selected'\][\s\S]*\.choice-option__number/u,
);
assert.match(sharedStyles, /\.choice-option\s*\{[\s\S]*min-height:\s*60px;/u);
assert.match(
	sharedStyles,
	/\.choice-option\[data-state='selected'\][\s\S]*box-shadow:[^;]*var\(--vocora-information-border\)/u,
);
assert.match(clozeTemplate, /<textarea\s+[\s\S]*class="cloze-input"/u);
assert.doesNotMatch(clozeTemplate, /<input\s+[\s\S]*class="cloze-input"/u);
assert.doesNotMatch(clozeTemplate, /<textarea\s+[\s\S]*matInput/u);
for (const attribute of [
	'rows="1"',
	'autocomplete="off"',
	'autocapitalize="none"',
	'autocorrect="off"',
	'spellcheck="false"',
]) {
	assert.match(clozeTemplate, new RegExp(attribute, 'u'));
}
assert.match(clozeTemplate, /class="cloze-input-measure"/u);
assert.doesNotMatch(clozeTemplate, /\[attr\.size\]/u);
assert.doesNotMatch(clozeTemplate, /<mat-select/u);
assert.match(clozeTemplate, /class="cloze-choice-grid choice-grid"/u);
assert.match(clozeTemplate, /class="choice-option"/u);
assert.match(
	sharedStyles,
	/\.cloze-input,\s*\.cloze-choice-blank\s*\{[\s\S]*border-bottom:[^;]*var\(--vocora-border\)/u,
);
assert.match(
	sharedStyles,
	/\.cloze-input:focus[\s\S]*var\(--vocora-information\)/u,
);
assert.match(
	sharedStyles,
	/\.cloze-input\s*\{[\s\S]*resize:\s*none;[\s\S]*overflow:\s*hidden;/u,
);
assert.match(
	sharedStyles,
	/\.inline-field--text:has\(\.cloze-input\)\s*\{[\s\S]*display:\s*inline-grid;/u,
);
assert.match(
	layoutStyles,
	/\.slide-exercise__content\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*600px;/u,
	'Exercise slide content must be constrained to the shared 600px layout width.',
);
assert.match(
	sharedStyles,
	/@media \(max-width:\s*620px\)[\s\S]*\.matching-grid\s*\{[^}]*row-gap:\s*var\(--vocora-space-6\);/u,
	'Mobile matching columns must have a clear group separation.',
);
assert.match(
	sharedStyles,
	/\.cloze-input-measure\s*\{[\s\S]*white-space:\s*pre;[\s\S]*visibility:\s*hidden;/u,
);
assert.match(
	sharedStyles,
	/\.cloze-input\s*\{[\s\S]*position:\s*absolute;[\s\S]*width:\s*100%;/u,
);

console.log('Reusable slide component structure contract passed.');
