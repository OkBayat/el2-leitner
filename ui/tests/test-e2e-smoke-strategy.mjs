import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(uiRoot, '..');
const e2eRoot = path.join(uiRoot, 'e2e');
const workflowRoot = path.join(repositoryRoot, '.github', 'workflows');

const specFiles = fs.readdirSync(e2eRoot)
	.filter(name => name.endsWith('.spec.ts'))
	.sort();
const declarations = specFiles.flatMap(name => {
	const source = fs.readFileSync(path.join(e2eRoot, name), 'utf8');
	assert.doesNotMatch(source, /\b(?:page|context)\.route\s*\(/u,
		`${name} must exercise the real system rather than mocked browser routes.`);
	assert.doesNotMatch(source, /\bfor\s*\(/u,
		`${name} must not multiply smoke scenarios through parameterized loops.`);
	return [...source.matchAll(/\btest\s*\(\s*(['"`])(.+?)\1/gu)]
		.map(match => ({file: name, title: match[2]}));
});

assert.ok(declarations.length >= 2 && declarations.length <= 3,
	`Playwright must contain only 2 or 3 smoke scenarios; found ${declarations.length}.`);

const workflowFiles = fs.readdirSync(workflowRoot)
	.filter(name => /\.ya?ml$/u.test(name));
for (const name of workflowFiles) {
	const source = fs.readFileSync(path.join(workflowRoot, name), 'utf8');
	assert.doesNotMatch(source, /(?:playwright(?:\s+install|\s+test)|npm\s+run\s+e2e|@playwright\/test)/iu,
		`${name} must not install or run Playwright in GitHub CI.`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(uiRoot, 'package.json'), 'utf8'));
assert.equal(packageJson.scripts['e2e'], 'npm run e2e:smoke');
assert.equal(packageJson.scripts['e2e:smoke'], 'playwright test e2e/smoke.spec.ts');

console.log(`E2E smoke strategy validated: ${declarations.length} real-system scenarios across ${specFiles.length} file(s).`);
