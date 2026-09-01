import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(uiRoot, relative));

for (const legacy of [
  'app-v2.js', 'auth.js', 'auth.css', 'library.js', 'library.css',
  'leitner-house.js', 'leitner-house.css', 'login.html', 'register.html',
  'library.html', 'leitner-house.html', 'styles-v2.css', 'styles.css'
]) {
  assert.equal(exists(legacy), false, `${legacy} must not remain in the Angular runtime.`);
}

for (const required of [
  'angular.json', 'src/main.ts', 'src/app/app.routes.ts', 'src/app/app.config.ts',
  'src/app/core/http/api-client.service.ts', 'src/app/core/auth/auth.service.ts',
  'src/app/core/state/learning-store.service.ts',
  'src/app/domain/learning/learning-rules.ts',
  'src/app/features/auth/login-page.component.ts',
  'src/app/features/auth/register-page.component.ts',
  'src/app/features/dashboard/dashboard-page.component.ts',
  'src/app/features/review/review-page.component.ts',
  'src/app/features/words/words-page.component.ts',
  'src/app/features/reports/reports-page.component.ts',
  'src/app/features/settings/settings-page.component.ts',
  'src/app/features/library/library-page.component.ts',
  'src/app/features/leitner-house/leitner-house-page.component.ts',
  'e2e/vocora.spec.ts', 'playwright.config.ts'
]) assert.ok(exists(required), `${required} is required by the Angular migration.`);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.dependencies['@angular/material'], '22.1.4');
assert.equal(pkg.dependencies['@angular/cdk'], '22.1.4');
assert.match(pkg.scripts.test, /ng test/u);
assert.match(pkg.scripts.e2e, /playwright test/u);
assert.match(pkg.scripts['check:architecture'], /test-angular-architecture/u);

const routes = read('src/app/app.routes.ts');
for (const route of ['login', 'register', 'dashboard', 'review', 'words', 'reports', 'settings', 'library', 'leitner-house/:house']) {
  assert.ok(routes.includes(`path: '${route}'`), `Route ${route} must exist.`);
}

const sourceRoot = path.join(uiRoot, 'src', 'app');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
for (const file of walk(sourceRoot).filter((item) => item.endsWith('.ts') && !item.endsWith('.spec.ts'))) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /document\.querySelector|innerHTML\s*=|addEventListener\(/u, `${path.relative(uiRoot, file)} must use Angular templates/bindings rather than legacy DOM scripting.`);
}

console.log('Angular architecture migration contract passed.');
