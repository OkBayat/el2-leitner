import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(uiRoot, relative));

for (const legacy of [
  'app-v2.js', 'auth.js', 'auth.css', 'library.js', 'library.css', 'library.html', 'library-integration.css', 'library-import-template.js',
  'leitner-house.js', 'leitner-house.css', 'leitner-house.html', 'leitner-status.js', 'leitner-status.css',
  'login.html', 'register.html', 'index.html', 'styles-v2.css', 'styles.css',
  'practice-remediation.js', 'practice-remediation.css', 'practice-remediation-adapter.js', 'practice-remediation-keyboard-guard.js', 'practice-remediation-recheck-prompt.js',
  'session-persistence.js', 'share-story-v2.js', 'vocabulary.js', 'word-collections.js', 'tools/build-vocabulary.mjs'
]) {
  assert.equal(exists(legacy), false, `${legacy} must not remain after the Angular cutover.`);
}

for (const required of [
  'angular.json', 'src/index.html', 'src/styles.scss', 'src/main.ts', 'src/app/app.ts', 'src/app/app.routes.ts', 'src/app/app.config.ts',
  'src/app/core/http/api-client.service.ts', 'src/app/core/auth/auth.service.ts', 'src/app/core/auth/auth.guard.ts',
  'src/app/core/state/learning-store.service.ts', 'src/app/core/persistence/review-persistence.service.ts',
  'src/app/core/learning/vocabulary-api.service.ts', 'src/app/core/library/library-api.service.ts',
  'src/app/domain/learning/learning-rules.ts', 'src/app/domain/remediation/remediation.ts',
  'src/app/application/review/review-session.service.ts',
  'src/app/features/auth/login-page.component.ts', 'src/app/features/auth/register-page.component.ts',
  'src/app/features/dashboard/dashboard-page.component.ts', 'src/app/features/review/review-page.component.ts',
  'src/app/features/words/words-page.component.ts', 'src/app/features/reports/reports-page.component.ts',
  'src/app/features/settings/settings-page.component.ts', 'src/app/features/library/library-page.component.ts',
  'src/app/features/library/library-dialogs.component.ts', 'src/app/features/leitner-house/leitner-house-page.component.ts',
  'src/app/shared/share-story/share-story.service.ts', 'src/app/shared/share-story/share-story-dialog.component.ts',
  'e2e/vocora.spec.ts', 'playwright.config.ts', 'tools/ci-vocabulary.mjs'
]) assert.ok(exists(required), `${required} is required by the Angular migration.`);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.dependencies['@angular/material'], '22.1.4');
assert.equal(pkg.dependencies['@angular/cdk'], '22.1.4');
assert.match(pkg.scripts.test, /check:architecture.*ng test/u);
assert.match(pkg.scripts.e2e, /playwright test/u);
assert.match(pkg.scripts['build:production'], /ng build/u);

const routes = read('src/app/app.routes.ts');
for (const route of ['login', 'register', 'dashboard', 'review', 'words', 'reports', 'settings', 'library', 'leitner-house/:house']) {
  assert.ok(routes.includes(`path: '${route}'`), `Route ${route} must exist.`);
}

const angular = JSON.parse(read('angular.json'));
const build = angular.projects.vocora.architect.build;
assert.equal(build.builder, '@angular/build:application');
assert.equal(build.options.browser, 'src/main.ts');
assert.ok(build.options.assets.some((asset) => asset.input === 'assets'));
assert.ok(build.options.assets.some((asset) => asset.input === 'data'));
assert.ok(build.options.assets.some((asset) => asset.input === 'fonts'));

const theme = read('src/styles.scss');
assert.match(theme, /@use ['"]@angular\/material['"] as mat/u);
assert.match(theme, /@include mat\.theme/u);
assert.match(theme, /--mat-sys-/u);

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

const allSource = walk(sourceRoot).filter((item) => item.endsWith('.ts')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const materialModule of ['MatButtonModule', 'MatCardModule', 'MatFormFieldModule', 'MatInputModule', 'MatSelectModule', 'MatDialogModule', 'MatTableModule']) {
  assert.ok(allSource.includes(materialModule), `${materialModule} must be used by the migrated frontend.`);
}

console.log('Angular architecture migration contract passed.');
