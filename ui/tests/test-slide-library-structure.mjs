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

console.log('Reusable slide component structure contract passed.');
