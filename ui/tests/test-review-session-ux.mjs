import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const uxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../review-session-ux.css', import.meta.url), 'utf8');
const guardSource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');

assert.match(guardSource, /review-session-ux\.js/, 'Keyboard guard must load review UX before practice interaction.');
assert.doesNotMatch(uxSource, /vocoraRemediationPreviewContinue/, 'Review UX must not create a duplicate remediation Continue CTA.');

const dom = new JSDOM(`<!doctype html><html lang="fa" dir="rtl"><head></head><body>
<div class="app-shell">
  <aside class="sidebar">nav</aside>
  <main class="main-content">
    <header class="topbar">header</header>
    <section class="view active" id="view-review">
      <div id="reviewSession" class="review-session">
        <div class="session-bar">
          <button id="exitSessionBtn" class="icon-btn" type="button">×</button>
          <div class="session-progress">
            <div class="row-between"><span id="sessionCounter">کارت ۱ از ۱۰</span><span id="sessionAccuracy">دقت: ۶۵٪</span></div>
            <div class="progress-track"><i id="sessionProgressBar"></i></div>
          </div>
        </div>

        <article id="flashCard" class="flash-card">
          <div class="card-meta"><span id="cardCategory">Test</span><span id="cardBox">خانه ۱</span></div>
          <p id="cardInstruction">کلمه را بشنو و املای آن را بنویس.</p>
          <button id="listenWordBtn" type="button"><span>▶</span><small>پخش تلفظ</small></button>
          <button id="slowListenBtn" type="button">پخش آهسته‌تر</button>

          <form id="answerForm" autocomplete="off">
            <label class="answer-label" for="answerInput">پاسخ شما</label>
            <input id="answerInput">
            <button class="btn btn-primary wide" type="submit">بررسی پاسخ</button>
          </form>
          <button id="dontKnowBtn" type="button">نمی‌دانم</button>

          <div id="answerFeedback" class="answer-feedback hidden">
            <div class="feedback-heading"><span id="feedbackIcon">✓</span><div><strong id="feedbackTitle">درست بود!</strong><p id="feedbackDetail"></p></div></div>
            <div class="correct-spelling"><small>املای صحیح</small><strong id="correctAnswer"></strong></div>
            <p id="wordNote"></p>
            <button id="nextCardBtn" class="btn btn-primary wide" type="button">کارت بعدی</button>
          </div>

          <section id="practiceRemediation" class="practice-remediation hidden">
            <div class="remediation-heading">
              <span id="remediationKicker" class="remediation-kicker">اصلاح فوری</span>
              <h3 id="remediationTitle">اشتباه را دقیق ببین</h3>
              <p id="remediationDescription">تفاوت پاسخ را بررسی کن.</p>
            </div>
            <div id="remediationComparison" class="remediation-comparison">
              <div class="remediation-spelling-row"><div class="remediation-spelling">havnt</div></div>
              <div class="remediation-spelling-row"><div class="remediation-spelling">haven't</div></div>
            </div>
            <p id="remediationHint" class="remediation-hint"></p>
            <button id="remediationListenBtn" class="remediation-listen" type="button">پخش تلفظ</button>
            <form id="remediationForm" class="remediation-form" autocomplete="off">
              <label id="remediationInputLabel" for="remediationInput">املای کلمه</label>
              <input id="remediationInput" class="answer-input">
              <p id="remediationValidation" class="remediation-validation"></p>
              <button id="remediationSubmitBtn" class="btn btn-primary wide" type="submit">بررسی</button>
            </form>
            <div class="remediation-actions">
              <button id="remediationAcknowledgeBtn" class="btn btn-primary wide" type="button">متوجه شدم</button>
              <button id="remediationContinueBtn" class="btn btn-primary wide" type="button">ادامهٔ تمرین</button>
            </div>
          </section>
        </article>
      </div>
    </section>
  </main>
</div>
</body></html>`, {
  url: 'https://vocora.test/#review',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });

const viewportListeners = new Map();
const visualViewport = {
  height: 800,
  offsetTop: 0,
  addEventListener(type, handler) {
    if (!viewportListeners.has(type)) viewportListeners.set(type, []);
    viewportListeners.get(type).push(handler);
  }
};
Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

let currentWord = { id: 'word-1', term: "haven't", accepted: ["haven't"], category: 'Test', box: 1 };
let remediationActive = null;
window.VazheyarTest = { getCurrentWord: () => currentWord };
window.VocoraPracticeRemediation = {
  snapshot: () => ({ active: remediationActive, queue: [] })
};

window.eval(uxSource);
const api = window.VocoraReviewSessionUx;
assert.ok(api?.PracticeSessionComponent, 'The review presentation must be implemented as one reusable component.');
assert.ok(api?.PracticeStage, 'The component must expose explicit stable stages.');

const controller = api.install(window, document);
assert.ok(controller, 'Review session UX must install.');
controller.sync();

const input = document.querySelector('#answerInput');
const remediationInput = document.querySelector('#remediationInput');
const form = document.querySelector('#answerForm');
const primary = form.querySelector('button[type="submit"]');
const dontKnow = document.querySelector('#dontKnowBtn');
const feedback = document.querySelector('#answerFeedback');
const remediation = document.querySelector('#practiceRemediation');
const flashCard = document.querySelector('#flashCard');
const title = document.querySelector('#feedbackTitle');
const detail = document.querySelector('#feedbackDetail');
const correctAnswer = document.querySelector('#correctAnswer');
const next = document.querySelector('#nextCardBtn');
const hint = document.querySelector('#vocoraDoubleTapHint');

function assertStage(stage, message = stage) {
  assert.equal(document.querySelector('#reviewSession').dataset.vocoraStage, stage, message);
  assert.equal(controller.getState().stage, stage, message);
  assert.equal(controller.getState().renderable, true, `${stage} must always render visible content.`);
}

function resetToAnswer() {
  remediationActive = null;
  remediation.classList.add('hidden');
  remediation.classList.remove('vocora-remediation-delayed');
  flashCard.classList.remove('remediation-active');
  feedback.classList.add('hidden');
  feedback.classList.remove('wrong');
  form.classList.remove('hidden');
  input.value = '';
  input.readOnly = false;
  controller.updatePrimaryState();
  controller.sync();
  assertStage('answer');
}

function showFeedback({ answer, wrong = false }) {
  input.value = answer;
  form.classList.add('hidden');
  feedback.classList.remove('hidden');
  feedback.classList.toggle('wrong', wrong);
  controller.sync();
}

assert.equal(document.querySelector('#vocora-review-session-ux-style')?.getAttribute('href'), 'review-session-ux.css');
assert.ok(document.body.classList.contains('vocora-session-active'));
assert.ok(document.documentElement.classList.contains('vocora-session-active'));
assert.equal(document.querySelector('#sessionAccuracy').parentElement.id, 'vocoraSessionAccuracy');
assertStage('answer');

// Component structure: hint belongs directly below input, then the one primary CTA.
assert.equal(input.getAttribute('aria-label'), 'پاسخ');
assert.equal(input.nextElementSibling, hint, 'The double-tap hint must be directly below the answer input.');
assert.equal(hint.nextElementSibling, primary, 'The primary action must follow the hint in the shared answer stack.');
assert.ok(primary.classList.contains('is-empty'));
assert.ok(!primary.disabled, 'Empty primary remains clickable only for the deliberate double-tap gesture.');
assert.equal(document.querySelectorAll('#vocoraDoubleTapHint').length, 1, 'The hint must never be duplicated.');
assert.equal(document.querySelector('#vocoraRemediationPreviewContinue'), null, 'There must be no second remediation Continue control.');

// Browser/keyboard autofill minimization is applied consistently to every spelling input.
for (const spellingInput of [input, remediationInput]) {
  assert.equal(spellingInput.getAttribute('autocomplete'), 'off');
  assert.equal(spellingInput.getAttribute('autocorrect'), 'off');
  assert.equal(spellingInput.getAttribute('autocapitalize'), 'none');
  assert.equal(spellingInput.getAttribute('spellcheck'), 'false');
  assert.equal(spellingInput.getAttribute('aria-autocomplete'), 'none');
  assert.equal(spellingInput.getAttribute('data-form-type'), 'other');
  assert.equal(spellingInput.getAttribute('data-lpignore'), 'true');
  assert.equal(spellingInput.getAttribute('data-1p-ignore'), 'true');
  assert.equal(spellingInput.getAttribute('data-bwignore'), 'true');
}

// Empty primary: first tap arms, second tap reuses the existing business dontKnow action.
let skips = 0;
dontKnow.addEventListener('click', () => { skips += 1; });
let tap = new window.MouseEvent('click', { bubbles: true, cancelable: true });
primary.dispatchEvent(tap);
assert.equal(tap.defaultPrevented, true);
assert.equal(skips, 0);
assert.ok(primary.classList.contains('skip-armed'));
tap = new window.MouseEvent('click', { bubbles: true, cancelable: true });
primary.dispatchEvent(tap);
assert.equal(skips, 1, 'Second quick empty tap must invoke the existing dontKnow action exactly once.');

// Warning result.
showFeedback({ answer: '', wrong: true });
assertStage('feedback-warning');
assert.equal(title.textContent, 'اشکالی ندارد');
assert.equal(document.querySelector('#feedbackIcon').textContent, '!');
assert.equal(correctAnswer.textContent, "haven't");
assert.equal(input.readOnly, true);
assert.equal(next.textContent, 'ادامه');

// Wrong result.
resetToAnswer();
input.value = 'havnt';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.ok(!primary.classList.contains('is-empty'));
title.textContent = 'legacy';
detail.textContent = 'legacy';
correctAnswer.textContent = '';
showFeedback({ answer: 'havnt', wrong: true });
assertStage('feedback-wrong');
assert.equal(title.textContent, 'اشتباه بود');
assert.equal(detail.textContent, 'پاسخ درست را یک بار با دقت ببین.');
assert.equal(correctAnswer.textContent, "haven't");
assert.equal(input.readOnly, true);

// Correct result keeps useful Leitner detail and uses the same component.
resetToAnswer();
input.value = "haven't";
input.dispatchEvent(new window.Event('input', { bubbles: true }));
title.textContent = 'درست بود!';
detail.textContent = 'از خانهٔ ۱ به خانهٔ ۲ رفت.';
showFeedback({ answer: "haven't", wrong: false });
assertStage('feedback-correct');
assert.equal(title.textContent, 'عالیه!');
assert.equal(detail.textContent, 'از خانهٔ ۱ به خانهٔ ۲ رفت.', 'Useful Leitner transition detail must be preserved.');
assert.equal(input.readOnly, true);

// Immediate wrong assessment -> same feedback Continue -> correction component.
resetToAnswer();
input.value = 'havnt';
title.textContent = 'legacy';
detail.textContent = 'legacy';
correctAnswer.textContent = '';
showFeedback({ answer: 'havnt', wrong: true });
remediationActive = { wordId: 'word-1', phase: 'correction', context: 'immediate', recheckNumber: 0 };
remediation.classList.remove('hidden');
flashCard.classList.add('remediation-active');
document.dispatchEvent(new window.CustomEvent('vocora:spelling-remediation-started', {
  detail: { wordId: 'word-1', mode: 'box1', context: 'immediate' }
}));
controller.sync();
assert.equal(controller.getState().delayedRemediation, true);
assertStage('feedback-wrong');
assert.ok(remediation.classList.contains('vocora-remediation-delayed'));
assert.ok(!flashCard.classList.contains('remediation-active'), 'Feedback preview must remain visible before correction.');
assert.equal(document.querySelectorAll('#nextCardBtn').length, 1, 'The existing feedback Continue is the only CTA.');

const continueEvent = new window.MouseEvent('click', { bubbles: true, cancelable: true });
next.dispatchEvent(continueEvent);
assert.equal(continueEvent.defaultPrevented, true, 'Shared Continue must be intercepted while remediation is delayed.');
assert.equal(controller.getState().delayedRemediation, false);
assert.ok(flashCard.classList.contains('remediation-active'));
assertStage('remediation-correction');

// Every internal remediation page is a stage of the exact same component.
for (const phase of ['recall', 'copy', 'completed']) {
  remediationActive = { wordId: 'word-1', phase, context: 'immediate', recheckNumber: 0 };
  remediation.classList.remove('hidden');
  flashCard.classList.add('remediation-active');
  controller.sync();
  assertStage(`remediation-${phase}`);
}

// Same-session recheck uses the same component too, not a second page model.
remediationActive = { wordId: 'word-1', phase: 'recall', context: 'recheck', recheckNumber: 1 };
remediation.classList.remove('hidden');
flashCard.classList.add('remediation-active');
controller.sync();
assertStage('remediation-recall');

// Regression: stale remediation-active after a successful transition used to hide
// every direct child and leave a completely white card. A visible primary form must
// always normalize back to the answer stage and clear that stale class.
remediationActive = null;
remediation.classList.add('hidden');
feedback.classList.add('hidden');
form.classList.remove('hidden');
flashCard.classList.add('remediation-active');
currentWord = { id: 'word-2', term: 'airport', accepted: ['airport'], category: 'Travel', box: 1 };
controller.sync();
assertStage('answer', 'A new primary card must recover from a stale remediation class.');
assert.ok(!flashCard.classList.contains('remediation-active'), 'Stale remediation-active must be removed on the next primary card.');
assert.ok(!form.classList.contains('hidden'), 'The answer form must remain visible.');

// Defensive invariant: even if both the stale class and a hidden form survive a
// race, the component repairs the stable primary stage instead of rendering white.
let recoveries = 0;
document.addEventListener('vocora:review-ui-recovered', () => { recoveries += 1; });
form.classList.add('hidden');
feedback.classList.add('hidden');
remediation.classList.add('hidden');
flashCard.classList.add('remediation-active');
controller.sync();
assertStage('answer', 'A stable session can never have an empty white practice stage.');
assert.equal(recoveries, 1, 'Blank-card recovery must be observable and deterministic.');
assert.ok(!form.classList.contains('hidden'));
assert.ok(!flashCard.classList.contains('remediation-active'));

// Keyboard viewport state is shared by primary and internal remediation inputs.
input.focus();
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'));
input.blur();
visualViewport.height = 520;
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'), 'Reduced visual viewport must keep compact keyboard mode active.');
visualViewport.height = 800;
controller.syncVisualViewport();
assert.ok(!document.body.classList.contains('vocora-keyboard-open'));

remediationActive = { wordId: 'word-2', phase: 'recall', context: 'recheck', recheckNumber: 1 };
remediation.classList.remove('hidden');
flashCard.classList.add('remediation-active');
controller.sync();
remediationInput.focus();
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'), 'Remediation input must use the same keyboard-aware component.');
remediationInput.blur();

// Navigation/session cleanup restores the ordinary app shell.
const reviewView = document.querySelector('#view-review');
reviewView.classList.remove('active');
controller.sync();
assert.ok(!document.body.classList.contains('vocora-session-active'), 'Navigating away releases the fixed shell even if session markup remains mounted.');
reviewView.classList.add('active');
controller.sync();
assert.ok(document.body.classList.contains('vocora-session-active'));
document.querySelector('#reviewSession').classList.add('hidden');
controller.sync();
assert.ok(!document.body.classList.contains('vocora-session-active'));
assert.ok(!document.documentElement.classList.contains('vocora-session-active'));

// Structural regression checks for the mobile stylesheet/component contract.
assert.match(cssSource, /body\.vocora-session-active \.sidebar[\s\S]*display:\s*none\s*!important/);
assert.match(cssSource, /body\.vocora-session-active[\s\S]*position:\s*fixed/);
assert.match(cssSource, /#answerForm \.answer-label[\s\S]*clip-path:\s*inset\(50%\)/);
assert.match(cssSource, /#dontKnowBtn\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSource, /data-vocora-stage="feedback-correct"[\s\S]*#answerFeedback/);
assert.match(cssSource, /data-vocora-stage="feedback-wrong"[\s\S]*#answerFeedback/);
assert.match(cssSource, /data-vocora-stage="feedback-warning"[\s\S]*#answerFeedback/);
assert.match(cssSource, /data-vocora-stage\^="remediation-"[\s\S]*#practiceRemediation/);
assert.match(cssSource, /#practiceRemediation \.remediation-heading[\s\S]*background:\s*transparent/,
  'Internal remediation heading must use the shared clean surface, not the old blue card.');
assert.match(cssSource, /vocora-keyboard-open[\s\S]*#answerForm/);
assert.doesNotMatch(cssSource, /vocora-remediation-preview-continue/, 'Styles must not support a duplicated Continue action.');

console.log('Unified review session component tests passed.');
