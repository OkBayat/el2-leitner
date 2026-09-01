import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const srcRoot = path.join(uiRoot, 'src');
const read = (relativePath) => fs.readFileSync(path.join(uiRoot, relativePath), 'utf8');

const requiredFiles = [
  'src/shared/http/HttpClient.js',
  'src/shared/navigation/SafeReturnTo.js',
  'src/features/auth/application/AuthCommands.js',
  'src/features/auth/infrastructure/AuthHttpGateway.js',
  'src/features/auth/presentation/AuthPage.js',
  'src/features/auth/index.js',
  'src/features/leitner-house/domain/LeitnerHouse.js',
  'src/features/leitner-house/application/GetLeitnerHouse.js',
  'src/features/leitner-house/infrastructure/LeitnerHouseHttpGateway.js',
  'src/features/leitner-house/presentation/LeitnerHousePage.js',
  'src/features/leitner-house/index.js',
  'src/design-system/material3.css'
];
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(uiRoot, file)), `${file} must exist.`);
}

for (const obsolete of ['auth.js', 'leitner-house.js', 'material3.css']) {
  assert.equal(
    fs.existsSync(path.join(uiRoot, obsolete)),
    false,
    `${obsolete} must be removed after its owner moves into src/.`
  );
}

const pageContracts = [
  ['login.html', './src/features/auth/index.js'],
  ['register.html', './src/features/auth/index.js'],
  ['leitner-house.html', './src/features/leitner-house/index.js']
];
for (const [page, modulePath] of pageContracts) {
  const document = new JSDOM(read(page)).window.document;
  const module = document.querySelector(`script[type="module"][src="${modulePath}"]`);
  assert.ok(module, `${page} must boot through ${modulePath}.`);
}

for (const page of ['index.html', 'library.html', 'leitner-house.html', 'login.html', 'register.html']) {
  const document = new JSDOM(read(page)).window.document;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((node) => node.getAttribute('href')?.split(/[?#]/u, 1)[0])
    .filter(Boolean);
  assert.equal(styles.at(-1), 'src/design-system/material3.css', `${page} must consume the shared design-system entrypoint last.`);
}

const allowedRootScripts = new Set([
  'app-v2.js',
  'leitner-status.js',
  'library-import-template.js',
  'library.js',
  'practice-remediation-adapter.js',
  'practice-remediation-keyboard-guard.js',
  'practice-remediation-recheck-prompt.js',
  'practice-remediation.js',
  'session-persistence.js',
  'share-story-v2.js',
  'vocabulary.js',
  'word-collections.js'
]);
const rootScripts = fs.readdirSync(uiRoot)
  .filter((name) => name.endsWith('.js'))
  .sort();
assert.deepEqual(rootScripts, [...allowedRootScripts].sort(), 'New feature JavaScript must live under src/, not grow the legacy root surface.');

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(fullPath);
  }
  return result;
}

const imports = (source) => [...source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu)]
  .map((match) => match[1]);

for (const file of walk(srcRoot)) {
  const relative = path.relative(uiRoot, file).replaceAll(path.sep, '/');
  const source = fs.readFileSync(file, 'utf8');
  const specs = imports(source);

  if (relative.includes('/domain/')) {
    for (const spec of specs) {
      assert.doesNotMatch(spec, /\/(?:application|infrastructure|presentation)\//u, `${relative}: domain must not depend outward.`);
    }
  }
  if (relative.includes('/application/')) {
    for (const spec of specs) {
      assert.doesNotMatch(spec, /\/(?:infrastructure|presentation)\//u, `${relative}: application must not depend on infrastructure/presentation.`);
    }
  }
  if (relative.includes('/infrastructure/')) {
    for (const spec of specs) {
      assert.doesNotMatch(spec, /\/presentation\//u, `${relative}: infrastructure must not depend on presentation.`);
    }
  }
  if (relative.includes('/presentation/')) {
    for (const spec of specs) {
      assert.doesNotMatch(spec, /\/infrastructure\//u, `${relative}: presentation must receive dependencies instead of constructing infrastructure.`);
    }
  }

  if (relative.startsWith('src/shared/')) {
    for (const spec of specs) {
      assert.doesNotMatch(spec, /features\//u, `${relative}: shared code must not depend on a feature.`);
    }
  }
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.dependencies, undefined, 'The frontend foundation must stay dependency-free until a concrete dependency is justified.');
assert.match(packageJson.scripts.test, /test-frontend-architecture\.mjs/u, 'The architecture contract must run in the default test suite.');

console.log('Frontend architecture constraints passed.');
