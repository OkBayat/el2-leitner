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
  'src/app/features/welcome/welcome-page.component.ts',
  'src/app/features/dashboard/dashboard-page.component.ts', 'src/app/features/review/review-page.component.ts',
  'src/app/features/review/review-page.component.html', 'src/app/features/review/review-page.component.scss',
  'src/app/features/review/review-answer-field.ts', 'src/app/features/review/review-answer-field.spec.ts',
  'src/app/features/review/review-context-badge.component.ts', 'src/app/features/review/review-context-badge.component.html',
  'src/app/features/review/review-context-badge.component.scss', 'src/app/features/review/review-context-badge.component.spec.ts',
  'src/app/features/words/words-page.component.ts', 'src/app/features/reports/reports-page.component.ts',
  'src/app/features/settings/settings-page.component.ts', 'src/app/features/library/library-page.component.ts',
  'src/app/features/library/library-dialogs.component.ts', 'src/app/features/leitner-house/leitner-house-page.component.ts',
  'src/app/shared/share-story/share-story.service.ts', 'src/app/shared/share-story/share-story-dialog.component.ts',
  'e2e/vocora.spec.ts', 'playwright.config.ts', 'tools/ci-vocabulary.mjs',
  'assets/welcome/welcome-illustration-1.jpg', 'assets/welcome/welcome-illustration-2.jpg',
  'assets/welcome/welcome-illustration-3.jpg', 'assets/welcome/welcome-illustration-4.jpg',
  'assets/welcome/welcome-illustration-5.jpg'
]) assert.ok(exists(required), `${required} is required by the Angular migration.`);

for (const removedWelcomeSvgComponent of [
  'src/app/features/welcome/welcome-illustration.component.ts',
  'src/app/features/welcome/welcome-illustration.component.html',
  'src/app/features/welcome/welcome-illustration.component.scss',
]) {
  assert.equal(
    exists(removedWelcomeSvgComponent),
    false,
    `${removedWelcomeSvgComponent} must not remain after the welcome image migration.`,
  );
}

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.dependencies['@angular/material'], '22.1.4');
assert.equal(pkg.dependencies['@angular/cdk'], '22.1.4');
assert.equal(pkg.dependencies.bootstrap, '5.3.8', 'Bootstrap CSS must stay pinned to the approved version.');
assert.match(pkg.scripts.test, /check:architecture.*ng test/u);
assert.match(pkg.scripts.e2e, /playwright test/u);
assert.match(pkg.scripts['build:production'], /ng build/u);

const routes = read('src/app/app.routes.ts');
for (const route of ['login', 'register', 'welcome', 'dashboard', 'review', 'words', 'reports', 'settings', 'library', 'leitner-house/:house']) {
  assert.ok(routes.includes(`path: '${route}'`), `Route ${route} must exist.`);
}
assert.match(routes, /\{ path: 'review', canActivate: \[authGuard\], loadComponent:/u, 'Review must remain authenticated while living outside the application shell.');
assert.equal(routes.match(/path: 'review'/gu)?.length, 1, 'Review must have exactly one route owner.');
assert.ok(routes.indexOf("path: 'review'") < routes.indexOf("loadComponent: () => import('./shared/app-shell/app-shell.component')"), 'Review must be routed before and outside AppShell.');

const angular = JSON.parse(read('angular.json'));
const build = angular.projects.vocora.architect.build;
assert.equal(build.builder, '@angular/build:application');
assert.equal(build.options.browser, 'src/main.ts');
assert.ok(build.options.assets.some((asset) => asset.input === 'assets'));
assert.ok(build.options.assets.some((asset) => asset.input === 'data'));
assert.ok(build.options.assets.some((asset) => asset.input === 'fonts'));
const bootstrapCss = 'node_modules/bootstrap/dist/css/bootstrap.min.css';
assert.ok(build.options.styles.includes(bootstrapCss), 'Bootstrap CSS must be loaded globally by Angular.');
assert.ok(build.options.styles.indexOf(bootstrapCss) < build.options.styles.indexOf('src/styles.scss'), 'Project styles must load after Bootstrap so application overrides keep precedence.');

const theme = read('src/styles.scss');
assert.match(theme, /@use ['"]@angular\/material['"] as mat/u);
assert.match(theme, /@include mat\.theme/u);
assert.match(theme, /--mat-sys-/u);
assert.match(theme, /direction\s*:\s*ltr/u, 'The global document flow must be left-to-right.');

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

const indexHtml = read('src/index.html');
assert.match(indexHtml, /<html\s+lang="en"\s+dir="ltr">/u, 'The Angular document must declare English LTR semantics.');
assert.doesNotMatch(indexHtml, /dir="rtl"|lang="fa"/u);

const userFacingSources = [
  ['src/index.html', indexHtml],
  ['src/styles.scss', theme],
  ...walk(sourceRoot)
    .filter((item) => item.endsWith('.ts') && !item.endsWith('.spec.ts'))
    .map((file) => [path.relative(uiRoot, file), fs.readFileSync(file, 'utf8')]),
];
for (const [name, source] of userFacingSources) {
  assert.doesNotMatch(source, /\p{Script=Arabic}/u, `${name} must not contain Persian/Arabic UI copy.`);
  assert.doesNotMatch(source, /fa-IR|dir=["']rtl["']/u, `${name} must not reintroduce Persian locale or RTL presentation.`);
}

const reviewPage = read('src/app/features/review/review-page.component.ts');
const reviewTemplate = read('src/app/features/review/review-page.component.html');
const reviewStyles = read('src/app/features/review/review-page.component.scss');
const reviewAnswerField = read('src/app/features/review/review-answer-field.ts');
const reviewAnswerFieldSpec = read('src/app/features/review/review-answer-field.spec.ts');
const reviewContextBadge = read('src/app/features/review/review-context-badge.component.ts');
const reviewContextBadgeSpec = read('src/app/features/review/review-context-badge.component.spec.ts');
assert.match(reviewTemplate, /#answerInput/u, 'Review answer input needs a stable template reference for focus management.');
assert.match(reviewPage, /focusAnswerInput/u, 'Review page must own explicit answer-input focus behavior.');
assert.match(reviewTemplate, /data-testid="review-layout"/u, 'Review page must own its standalone distraction-free layout.');
assert.match(reviewTemplate, /data-testid="review-session-bar"/u, 'Review page must own its compact session progress bar.');
assert.equal(reviewTemplate.match(/data-testid="session-accuracy"/gu)?.length, 1, 'The session bar must expose one live accuracy value.');
assert.match(reviewTemplate, /@let sessionAccuracy = session\.accuracy\(\);/u, 'The session bar must reuse the existing ReviewSessionService accuracy signal.');
assert.match(reviewTemplate, /Accuracy:\s*\{\{ sessionAccuracy === null \? '—' : sessionAccuracy \+ '%' \}\}/u, 'Live session accuracy must show an em dash before the first answer and a percentage afterwards.');
assert.equal(reviewTemplate.match(/data-testid="review-action-footer"/gu)?.length, 1, 'All review states must render through one shared footer block.');
assert.equal(reviewTemplate.match(/class="review-action-primary"/gu)?.length, 1, 'All review states must reuse one primary footer button.');
assert.equal(reviewTemplate.match(/class="review-action-secondary"/gu)?.length, 1, 'The optional secondary action must have one shared template owner.');
for (const tone of ['neutral', 'success', 'error', 'practice']) {
  assert.ok(reviewTemplate.includes(`[class.${tone}]="footer.tone === '${tone}'"`), `Footer tone ${tone} must be driven by the shared view model.`);
}
assert.match(reviewPage, /readonly footerState = computed<ReviewFooterState \| null>/u, 'Footer copy, tone, icon, and action must be owned by one computed view model.');
assert.match(reviewPage, /handleFooterPrimary\(action: ReviewFooterAction\)/u, 'The shared footer button must dispatch through one action handler.');
assert.match(reviewPage, /const CHECK_ANSWER_LABEL = 'Check answer'/u, 'Every answer-check state must share one Check answer label.');
assert.match(reviewPage, /function practiceFooter\(/u, 'Recall and copy footer states must share one practice-footer factory.');
assert.match(reviewPage, /function continueFooter\(/u, 'Success and correction footer states must share one continuation-footer factory.');
assert.match(reviewPage, /practiceFooter\('From memory'/u, 'Recall footer must provide status copy instead of rendering an empty yellow surface.');
assert.match(reviewPage, /continueFooter\('success', 'check', 'Correct!', 'You remembered the spelling\.'\)/u, 'Completed memory recall must use the shared green success state.');
assert.doesNotMatch(reviewPage, /primaryLabel:\s*'Check(?: answer)?'/u, 'Check button copy must not be duplicated across footer states.');
assert.match(reviewTemplate, /Correct spelling/u, 'Wrong-answer correction must continue exposing the accepted solution comparison.');
assert.equal(reviewTemplate.match(/<app-review-context-badge\/>/gu)?.length, 1, 'Review remediation context must have one shared marker owner.');
assert.doesNotMatch(reviewTemplate, /Type it carefully once|Type it again from memory|>Spelling correction</u, 'The orange context marker must replace duplicate remediation headings in the card body.');
assert.match(reviewContextBadge, /if \(remediation\.context === RemediationContext\.RECHECK\) return MISTAKE_RECHECK/u, 'A completed recheck must keep its context marker until Continue.');
assert.match(reviewContextBadge, /RemediationPhase\.RECALL \|\| remediation\.phase === RemediationPhase\.COMPLETED/u, 'A completed immediate recall must keep its memory context marker until Continue.');
assert.match(reviewContextBadgeSpec, /phase: RemediationPhase\.COMPLETED,[\s\S]*context: RemediationContext\.RECHECK/u, 'Context regression coverage must include successful completed rechecks.');
assert.equal(reviewTemplate.match(/class="review-answer-form"/gu)?.length, 1, 'Every review/remediation stage must render through one shared answer form.');
assert.equal(reviewTemplate.match(/class="review-answer-field"/gu)?.length, 1, 'Every review/remediation stage must render through one shared Material field.');
assert.equal(reviewTemplate.match(/class="review-answer-input"/gu)?.length, 1, 'Every review/remediation stage must render through one shared input element.');
assert.equal(reviewTemplate.match(/data-testid="review-answer-input"/gu)?.length, 1, 'The shared answer input must have one stable E2E locator.');
assert.equal(reviewTemplate.match(/autocapitalize="none"/gu)?.length, 1, 'The shared spelling input must disable mobile auto-capitalization.');
assert.equal(reviewTemplate.match(/autocorrect="off"/gu)?.length, 1, 'The shared spelling input must disable mobile auto-correction.');
assert.equal(reviewTemplate.match(/spellcheck="false"/gu)?.length, 1, 'The shared spelling input must disable browser spellcheck assistance.');
assert.doesNotMatch(reviewTemplate, /#remediationInput/u, 'A second remediation input must not be reintroduced.');
assert.doesNotMatch(reviewPage, /remediationAnswer|focusRemediationInput/u, 'Review and remediation must not keep separate input controls or focus paths.');
assert.match(reviewPage, /readonly answerFieldState = computed<ReviewAnswerFieldState \| null>/u, 'One TypeScript view model must own answer-field visibility, label, action, and disabled state.');
assert.match(reviewPage, /submitAnswer\(\)/u, 'All answer submissions must dispatch through one shared answer handler.');
assert.match(reviewAnswerField, /buildReviewAnswerFieldState/u, 'Answer-field state must be derived by a pure TypeScript function.');
assert.match(reviewAnswerField, /RemediationPhase\.CORRECTION/u, 'Correction must explicitly hide the redundant answer field.');
assert.match(reviewAnswerField, /RemediationPhase\.COMPLETED/u, 'Completed remediation/recheck must explicitly keep the shared field locked.');
assert.match(reviewAnswerFieldSpec, /currentTask: 'recheck'/u, 'The answer-field regression suite must cover scheduled rechecks.');
assert.match(reviewAnswerFieldSpec, /RemediationPhase\.COPY/u, 'The answer-field regression suite must cover copy mode.');
assert.match(reviewAnswerFieldSpec, /RemediationPhase\.COMPLETED/u, 'The answer-field regression suite must cover completed states.');
assert.match(reviewStyles, /min-height:\s*100dvh/u, 'Review layout must fill the viewport without depending on AppShell.');
assert.match(reviewStyles, /\.review-action-footer\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*0;/u, 'Review footer must stay fixed to the viewport bottom.');
assert.match(reviewStyles, /border-top:\s*2px solid var\(--review-footer-border-color\)/u, 'All footer tones must share one full-width divider implementation.');
assert.match(reviewStyles, /--review-success-background:\s*#d7ffb8/u, 'Correct feedback must use the approved light-green footer background.');
assert.match(reviewStyles, /--review-success-action:\s*#58cc02/u, 'Correct feedback must use the approved green primary action.');
assert.match(reviewStyles, /--review-error-background:\s*#ffdfe0/u, 'Wrong feedback must use the approved light-red footer background.');
assert.match(reviewStyles, /--review-error-action:\s*#ff4b4b/u, 'Wrong feedback must use the approved red primary action.');
assert.match(reviewStyles, /--review-practice-background:\s*#fff4cc/u, 'Recall/copy remediation must use the approved yellow footer.');
assert.match(reviewStyles, /--review-practice-action:\s*#ffc800/u, 'Recall/copy remediation must use the approved yellow primary action.');
assert.doesNotMatch(reviewStyles, /\.review-action-footer\.(?:success|error|practice)\s+\.review-action-primary/u, 'Footer tones must change shared CSS variables instead of duplicating primary-button rules.');
assert.doesNotMatch(reviewStyles, /\.footer-primary|\.footer-secondary|\.neutral-action-inner|\.feedback-action-inner/u, 'Review controls must not reintroduce duplicate legacy footer classes.');
assert.match(reviewStyles, /@media\(max-width:\s*600px\)/u, 'Review layout must have a dedicated mobile presentation.');

const allSource = walk(sourceRoot).filter((item) => item.endsWith('.ts')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const materialModule of ['MatButtonModule', 'MatCardModule', 'MatFormFieldModule', 'MatInputModule', 'MatSelectModule', 'MatDialogModule', 'MatTableModule']) {
  assert.ok(allSource.includes(materialModule), `${materialModule} must be used by the migrated frontend.`);
}

console.log('Angular architecture migration contract passed.');
