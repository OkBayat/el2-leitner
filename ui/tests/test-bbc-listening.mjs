import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(uiRoot, relative));

const required = [
  'src/app/domain/listening-practice/listening-practice.ts',
  'src/app/domain/listening-practice/listening-practice.spec.ts',
  'src/app/core/listening-practice/listening-practice-api.service.ts',
  'src/app/core/listening-practice/listening-practice-api.service.spec.ts',
  'src/app/application/listening-practice/listening-attempt.service.ts',
  'src/app/application/listening-practice/listening-attempt.service.spec.ts',
  'src/app/features/bbc-listening/bbc-lessons-page.component.ts',
  'src/app/features/bbc-listening/bbc-lessons-page.component.html',
  'src/app/features/bbc-listening/bbc-lessons-page.component.scss',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.ts',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.html',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.scss',
  'src/app/features/bbc-listening/bbc-listening-pages.spec.ts',
  'e2e/bbc-listening.spec.ts',
];
for (const file of required) assert.ok(exists(file), `${file} is required for BBC listening practice.`);

const routes = read('src/app/app.routes.ts');
assert.match(routes, /path: 'bbc-6-minute-english'/u, 'The BBC lesson catalog route must exist.');
assert.match(
  routes,
  /path: 'bbc-6-minute-english\/:lessonSlug\/practice'/u,
  'The selected BBC lesson must have a dedicated practice route.',
);

for (const component of [
  'src/app/features/bbc-listening/bbc-lessons-page.component.ts',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.ts',
]) {
  const source = read(component);
  assert.match(source, /templateUrl:/u, `${component} must use a separate HTML file.`);
  assert.match(source, /styleUrl:/u, `${component} must use a separate SCSS file.`);
  assert.doesNotMatch(source, /template\s*:/u, `${component} must not contain an inline template.`);
  assert.match(source, /ChangeDetectionStrategy\.OnPush/u, `${component} must use OnPush change detection.`);
}

const practice = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.ts');
const template = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.html');
assert.match(practice, /FormRecord<FormControl<string>>/u, 'Dynamic answers must use typed reactive forms.');
assert.match(template, /mat-radio-group/u, 'Single-choice IELTS questions must use Material radio controls.');
assert.match(template, /data-testid="submit-listening-attempt"/u, 'The complete exercise needs one stable submit action.');
assert.match(template, /\[readonly\]="submitted\(\)"/u, 'Text answers must be locked after submission.');
assert.match(template, /\[disabled\]="submitted\(\)"/u, 'Choice answers must be locked after submission.');
assert.match(template, /result\.score\.correct/u, 'The server score must be rendered after submission.');
assert.match(template, /feedback\?\.correct/u, 'Every answer must show correct or incorrect feedback.');

const api = read('src/app/core/listening-practice/listening-practice-api.service.ts');
assert.match(api, /\/api\/listening\/bbc\/lessons/u);
assert.match(api, /\/attempts/u);
assert.match(api, /\/submit/u);

const shell = read('src/app/shared/app-shell/app-shell.component.ts');
assert.match(shell, /BBC 6 Minute English/u, 'BBC listening must be available from the application menu.');
assert.match(
  shell,
  /item\.path !== '\/bbc-6-minute-english'/u,
  'The existing five-item mobile navigation must not become overcrowded.',
);

const dashboard = read('src/app/features/dashboard/dashboard-page.component.html');
assert.match(dashboard, /data-testid="open-bbc-listening"/u, 'Home must expose a direct BBC listening entry point.');

const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts.test, /check:bbc-listening/u, 'BBC architecture coverage must run in the standard UI test command.');
