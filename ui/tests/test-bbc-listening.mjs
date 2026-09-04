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
  'src/app/domain/listening-practice/listening-mistake-practice.ts',
  'src/app/domain/listening-practice/listening-mistake-practice.spec.ts',
  'src/app/core/listening-practice/listening-practice-api.service.ts',
  'src/app/core/listening-practice/listening-practice-api.service.spec.ts',
  'src/app/application/listening-practice/listening-attempt.service.ts',
  'src/app/application/listening-practice/listening-attempt.service.spec.ts',
  'src/app/application/listening-practice/listening-mistake-practice.service.ts',
  'src/app/application/listening-practice/listening-mistake-practice.service.spec.ts',
  'src/app/features/bbc-listening/bbc-lessons-page.component.ts',
  'src/app/features/bbc-listening/bbc-lessons-page.component.html',
  'src/app/features/bbc-listening/bbc-lessons-page.component.scss',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.ts',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.html',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.scss',
  'src/app/features/bbc-listening/bbc-listening-pages.spec.ts',
  'src/app/features/bbc-listening/listening-audio-player.component.ts',
  'src/app/features/bbc-listening/listening-audio-player.component.html',
  'src/app/features/bbc-listening/listening-audio-player.component.scss',
  'src/app/features/bbc-listening/listening-audio-player.component.spec.ts',
  'e2e/bbc-listening.spec.ts',
];
for (const file of required) assert.ok(exists(file), `${file} is required for BBC listening practice.`);

const routes = read('src/app/app.routes.ts');
const shellOwner = "loadComponent: () => import('./shared/app-shell/app-shell.component')";
const practiceRoute = "path: 'bbc-6-minute-english/:lessonSlug/tests/:testId/practice'";
assert.match(routes, /path: 'bbc-6-minute-english'/u, 'The BBC lesson catalog route must exist.');
assert.equal(
  routes.match(/path: 'bbc-6-minute-english\/:lessonSlug\/tests\/:testId\/practice'/gu)?.length,
  1,
  'A selected BBC test must have exactly one practice-route owner.',
);
assert.match(
  routes,
  /\{ path: 'bbc-6-minute-english\/:lessonSlug\/tests\/:testId\/practice', canActivate: \[authGuard\], loadComponent:/u,
  'The distraction-free BBC test page must remain authenticated.',
);
assert.ok(
  routes.indexOf(practiceRoute) < routes.indexOf(shellOwner),
  'BBC practice must be routed before and outside AppShell.',
);

for (const component of [
  'src/app/features/bbc-listening/bbc-lessons-page.component.ts',
  'src/app/features/bbc-listening/bbc-listening-practice-page.component.ts',
  'src/app/features/bbc-listening/listening-audio-player.component.ts',
]) {
  const source = read(component);
  assert.match(source, /templateUrl:/u, `${component} must use a separate HTML file.`);
  assert.match(source, /styleUrl:/u, `${component} must use a separate SCSS file.`);
  assert.doesNotMatch(source, /template\s*:/u, `${component} must not contain an inline template.`);
  assert.match(source, /ChangeDetectionStrategy\.OnPush/u, `${component} must use OnPush change detection.`);
}

const catalogTemplate = read('src/app/features/bbc-listening/bbc-lessons-page.component.html');
assert.match(catalogTemplate, /lesson\.tests/u, 'Each lesson card must render its tests dynamically.');
assert.match(catalogTemplate, /test\.completed/u, 'Each test must expose its own completion state.');
assert.match(catalogTemplate, /start-bbc-/u, 'Each test needs a stable start action.');
assert.match(catalogTemplate, /'tests', test\.id, 'practice'/u, 'Each test action must route by test id.');

const practice = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.ts');
const template = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.html');
assert.match(practice, /FormRecord<FormControl<string>>/u, 'Dynamic answers must use typed reactive forms.');
assert.match(practice, /toSignal\(/u, 'Answer progress must react to typed form value changes under OnPush.');
assert.match(practice, /paramMap\.get\('testId'\)/u, 'Practice must resolve the selected test from the route.');
assert.match(practice, /ListeningMistakePracticeService/u, 'Wrong-answer capture must be orchestrated through an application service.');
assert.match(practice, /ListeningAudioPlayerComponent/u, 'Episode audio must be rendered through its own component.');
assert.match(template, /app-listening-audio-player/u, 'The selected test must contain the in-app episode player.');
assert.match(template, /test\.groups/u, 'The practice page must render only the selected test groups.');
assert.match(template, /mat-radio-group/u, 'Single-choice IELTS questions must use Material radio controls.');
assert.match(template, /data-testid="submit-listening-attempt"/u, 'The selected test needs one stable submit action.');
assert.match(
  template,
  /<form \[formGroup\]="answers" \(keydown\.enter\)="\$event\.preventDefault\(\)" novalidate>/u,
  'Pressing Enter anywhere in the listening answer form must be explicitly ignored.',
);
assert.doesNotMatch(
  template,
  /\(ngSubmit\)="submit\(\)"/u,
  'Listening answers must not be submitted through the form submit event.',
);
assert.match(
  template,
  /type="button"[\s\S]*?data-testid="submit-listening-attempt"[\s\S]*?\(click\)="submit\(\)"/u,
  'Listening answers must be submitted only by clicking the explicit submit button.',
);
assert.match(template, /add-listening-word-/u, 'Eligible incorrect answers need a stable House 1 action.');
assert.match(template, /Add to House 1/u, 'The House 1 action must be explicit to the learner.');
assert.match(template, /\[readonly\]="submitted\(\)"/u, 'Text answers must be locked after submission.');
assert.match(template, /\[disabled\]="submitted\(\)"/u, 'Choice answers must be locked after submission.');
assert.match(template, /result\.score\.correct/u, 'The server score must be rendered after submission.');
assert.match(template, /feedback\?\.correct/u, 'Every answer must show correct or incorrect feedback.');

const audioPlayer = read('src/app/features/bbc-listening/listening-audio-player.component.html');
assert.match(audioPlayer, /<audio/u, 'The player must use the browser audio element.');
assert.doesNotMatch(audioPlayer, /autoplay/u, 'Listening audio must never autoplay.');
assert.match(audioPlayer, /audio-play/u, 'The player must expose Play.');
assert.match(audioPlayer, /audio-stop/u, 'The player must expose Stop.');
assert.match(audioPlayer, /audio-back-5/u, 'The player must expose five-second rewind.');
assert.match(audioPlayer, /audio-forward-5/u, 'The player must expose five-second forward seek.');

const mistakeDomain = read('src/app/domain/listening-practice/listening-mistake-practice.ts');
assert.match(mistakeDomain, /HAS_NUMBER/u, 'House 1 capture must reject answers containing numbers.');
assert.match(mistakeDomain, /Listening mistakes/u, 'New captured vocabulary must use the dedicated personal category.');

const api = read('src/app/core/listening-practice/listening-practice-api.service.ts');
assert.match(api, /\/api\/listening\/bbc\/lessons/u);
assert.match(api, /\/tests\//u, 'Starting an attempt must identify a test.');
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
