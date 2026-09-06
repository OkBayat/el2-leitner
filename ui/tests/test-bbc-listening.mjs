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

const listeningDomain = read('src/app/domain/listening-practice/listening-practice.ts');
assert.doesNotMatch(
  listeningDomain,
  /ListeningAudioProgress|buildListeningAudioProgress|currentRangeLabel/u,
  'Question-range audio progress must be removed from the Listening Practice domain when the UI no longer exposes it.',
);

const practice = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.ts');
const template = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.html');
const practiceStyles = read('src/app/features/bbc-listening/bbc-listening-practice-page.component.scss');
assert.match(practice, /FormRecord<FormControl<string>>/u, 'Dynamic answers must use typed reactive forms.');
assert.match(practice, /toSignal\(/u, 'Answer progress must react to typed form value changes under OnPush.');
assert.match(practice, /paramMap\.get\('testId'\)/u, 'Practice must resolve the selected test from the route.');
assert.match(practice, /ListeningMistakePracticeService/u, 'Wrong-answer capture must be orchestrated through an application service.');
assert.match(practice, /findExistingHouseOneTerms/u, 'Completed listening feedback must check current House 1 membership.');
assert.match(practice, /ListeningAudioPlayerComponent/u, 'Episode audio must be rendered through its own component.');
assert.match(template, /app-listening-audio-player/u, 'The selected test must contain the in-app episode player.');
assert.doesNotMatch(template, /\[test\]="test"/u, 'The audio player must not depend on the IELTS test after question-range progress is removed.');
assert.ok(
  template.indexOf('app-listening-audio-player') < template.indexOf('<header class="practice-header">'),
  'The sticky player must render before the exercise heading.',
);
assert.match(
  template,
  /data-testid="sticky-listening-audio-player"/u,
  'The sticky player shell needs a stable regression selector.',
);
assert.match(practiceStyles, /\.sticky-audio-player-shell[\s\S]*?position:\s*sticky/u, 'The episode player must stay sticky while questions scroll.');
assert.match(practiceStyles, /\.sticky-audio-player-shell[\s\S]*?top:/u, 'The sticky player must define its viewport offset.');
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
assert.match(
  template,
  /@if \(isVocabularyInHouseOne\(vocabulary\)\)[\s\S]*?Already in House 1[\s\S]*?@else[\s\S]*?Add to House 1/u,
  'Vocabulary already in House 1 must show status text instead of another add button.',
);
assert.match(template, /listening-word-in-house-1-/u, 'Existing House 1 status needs a stable regression selector.');
assert.match(template, /\[readonly\]="submitted\(\)"/u, 'Text answers must be locked after submission.');
assert.match(template, /\[disabled\]="submitted\(\)"/u, 'Choice answers must be locked after submission.');
assert.match(template, /result\.score\.correct/u, 'The server score must be rendered after submission.');
assert.match(template, /feedback\?\.correct/u, 'Every answer must show correct or incorrect feedback.');

const audioPlayerComponent = read('src/app/features/bbc-listening/listening-audio-player.component.ts');
const audioPlayer = read('src/app/features/bbc-listening/listening-audio-player.component.html');
const audioStyles = read('src/app/features/bbc-listening/listening-audio-player.component.scss');
assert.match(audioPlayer, /<audio/u, 'The player must use the browser audio element.');
assert.doesNotMatch(audioPlayer, /autoplay/u, 'Listening audio must never autoplay.');
assert.match(audioPlayer, /audio-play/u, 'The player must expose Play/Pause.');
assert.match(audioPlayer, /audio-stop/u, 'The player must expose Stop.');
assert.match(audioPlayer, /audio-back-5/u, 'The player must expose five-second rewind.');
assert.match(audioPlayer, /audio-forward-5/u, 'The player must expose five-second forward seek.');
assert.match(audioPlayer, /type="range"/u, 'The player must expose a draggable native audio scrubber.');
assert.match(audioPlayer, /data-testid="audio-progress"/u, 'The audio scrubber needs a stable regression selector.');
assert.doesNotMatch(audioPlayer, /audio-question-progress|Now around:|question-segment/u, 'Question-range UI must be removed completely from the player template.');
assert.match(audioPlayer, /data-testid="audio-collapsed-progress"/u, 'Collapsed mode must retain one visible playback-progress indicator.');
assert.match(audioPlayer, /\[class\.is-collapsed\]="collapsed\(\)"/u, 'The player surface must expose its scroll-collapse state to CSS.');
assert.match(audioPlayerComponent, /@HostListener\('window:scroll'\)/u, 'Player collapse/expand must react to viewport scroll direction through Angular.');
assert.match(audioPlayerComponent, /readonly collapsed = signal\(false\)/u, 'Scroll visibility must have one explicit signal owner.');
assert.match(audioPlayerComponent, /PLAYER_SCROLL_HYSTERESIS/u, 'Slow scrolling must use cumulative hysteresis instead of reacting to tiny direction changes.');
assert.match(audioPlayerComponent, /scrollAnchorY/u, 'Scroll direction must be anchored so micro-reversals do not flicker the player.');
assert.doesNotMatch(audioPlayerComponent, /lastScrollY/u, 'The old per-event direction comparison must not return.');
assert.doesNotMatch(audioPlayerComponent, /ListeningTest|buildListeningAudioProgress/u, 'Player TypeScript must contain no question-range mapping dependency.');
assert.match(audioPlayerComponent, /seekTo\(/u, 'The player must support direct left/right scrubbing.');
assert.match(audioPlayerComponent, /togglePlayback\(/u, 'The primary playback control must toggle Play and Pause.');
assert.match(audioStyles, /\.scrubber-track/u, 'The approved progress-line visual must remain explicit in player styling.');
assert.match(audioStyles, /\.audio-player\.is-collapsed/u, 'Collapsed player styling must be explicit and testable.');
assert.match(audioStyles, /\.collapsed-progress[\s\S]*?position:\s*absolute/u, 'Collapsed progress must float inside the stable sticky shell instead of changing layout height.');
assert.match(audioStyles, /\.collapsed-progress[\s\S]*?top:\s*-10px/u, 'Collapsed progress must align exactly with the top edge of the viewport when the sticky shell is active.');
assert.match(audioStyles, /\.collapsed-progress[\s\S]*?width:\s*100vw/u, 'Collapsed progress must span the full viewport width.');
assert.match(audioStyles, /\.collapsed-progress[\s\S]*?border-radius:\s*0/u, 'Full-width collapsed progress must meet the viewport edges without rounded end caps.');
assert.doesNotMatch(audioStyles, /grid-template-rows/u, 'Collapsing the player must not animate layout height because it causes scroll feedback flicker.');
assert.match(audioStyles, /will-change:\s*transform, opacity/u, 'The player reveal animation should stay on compositor-friendly properties.');
assert.doesNotMatch(audioStyles, /\.question-progress|\.question-segment|\.question-timeline/u, 'Question-range CSS must be removed completely.');

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
  /path: '\/bbc-6-minute-english'[\s\S]*?mobile: true/u,
  'BBC listening must remain one of the five direct mobile learning destinations.',
);
assert.match(shell, /mobileNavItems = this\.navItems\.filter\(item => item\.mobile\)/u, 'The mobile dock must derive its five direct learning destinations from the shared navigation model.');

const dashboard = read('src/app/features/dashboard/dashboard-page.component.html');
assert.match(dashboard, /data-testid="open-bbc-listening"/u, 'Home must expose a direct BBC listening entry point.');

const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts.test, /check:bbc-listening/u, 'BBC architecture coverage must run in the standard UI test command.');
