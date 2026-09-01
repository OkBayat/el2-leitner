import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relativePath) => fs.readFileSync(path.join(uiRoot, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(uiRoot, relativePath));

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.dependencies?.['@material/web'], '2.5.0', 'Production UI must use the pinned official Material Web package.');
assert.ok(packageJson.devDependencies?.rollup, 'Production Material Web imports need a bundler for bare module specifiers.');
assert.ok(packageJson.devDependencies?.['@rollup/plugin-node-resolve'], 'Rollup must resolve @material/web package imports.');
assert.match(packageJson.scripts.build || '', /rollup/u, 'The UI must expose a production Material Web build.');
assert.match(packageJson.scripts.test || '', /test-material-web-components\.mjs/u, 'Material Web component usage must be part of the default regression suite.');

for (const file of ['src/material-web.js', 'rollup.config.js']) {
  assert.ok(exists(file), `${file} must exist.`);
}

const materialEntry = read('src/material-web.js');
for (const componentImport of [
  '@material/web/button/filled-button.js',
  '@material/web/button/outlined-button.js',
  '@material/web/textfield/outlined-text-field.js',
  '@material/web/select/outlined-select.js',
  '@material/web/select/select-option.js'
]) {
  assert.ok(materialEntry.includes(componentImport), `Material bundle must import ${componentImport}.`);
}
assert.doesNotMatch(materialEntry, /@material\/web\/all\.js/u, 'Production bundle should import only the components Vocora actually uses.');

const pageContracts = [
  ['login.html', ['md-outlined-text-field', 'md-filled-button']],
  ['register.html', ['md-outlined-text-field', 'md-filled-button']],
  ['leitner-house.html', ['md-outlined-text-field', 'md-outlined-select', 'md-select-option', 'md-outlined-button']]
];

for (const [page, requiredTags] of pageContracts) {
  const document = new JSDOM(read(page)).window.document;
  const scripts = [...document.querySelectorAll('script[type="module"][src]')].map((node) => node.getAttribute('src'));
  assert.ok(scripts.includes('./dist/material-web.js'), `${page} must load the production Material Web bundle.`);
  for (const tag of requiredTags) assert.ok(document.querySelector(tag), `${page} must use ${tag}.`);
}

for (const page of ['login.html', 'register.html']) {
  const document = new JSDOM(read(page)).window.document;
  assert.equal(document.querySelectorAll('#authForm input, #authForm button, #authForm select').length, 0, `${page} must not recreate standard form primitives with native controls.`);
  assert.equal(document.querySelectorAll('#authForm md-outlined-text-field').length, 2, `${page} must use Material text fields for email and password.`);
  assert.equal(document.querySelectorAll('#authForm md-filled-button').length, 1, `${page} must use a Material filled submit button.`);
}

{
  const document = new JSDOM(read('leitner-house.html')).window.document;
  assert.equal(document.querySelectorAll('.leitner-house-controls input, .leitner-house-controls select').length, 0, 'Leitner search/sort must use Material components rather than styled native controls.');
  assert.ok(document.querySelector('#leitnerHouseSearch[listed=""]') === null, 'Material text fields must not carry invented compatibility attributes.');
}

const authCss = read('src/features/auth/presentation/auth.css');
assert.doesNotMatch(authCss, /\.auth-field\s+input|\.auth-submit/u, 'Auth feature CSS must not reimplement Material form primitives.');
const leitnerCss = read('src/features/leitner-house/presentation/leitner-house.css');
assert.doesNotMatch(leitnerCss, /leitner-house-search-wrap|\.leitner-house-controls\s+(?:input|select)/u, 'Leitner CSS must not reimplement Material search/select primitives.');

assert.ok(exists('dist/material-web.js'), 'npm test must build the production Material Web bundle before component contracts run.');
const bundle = read('dist/material-web.js');
assert.ok(bundle.length > 1000, 'Material Web production bundle must contain the resolved component implementation.');
assert.doesNotMatch(bundle, /from\s+['"]@material\/web\//u, 'Production bundle must not leave browser-unresolvable bare @material/web imports.');

console.log('Material Web component integration tests passed.');
