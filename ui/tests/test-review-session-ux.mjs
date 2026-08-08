import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const uxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../review-session-ux.css', import.meta.url), 'utf8');
const guardSource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');

assert.match(guardSource, /review-session-ux\.js/);
assert.doesNotMatch(uxSource, /delayedRemediation:\s*false/,
  'Review UX must not keep a second mutable copy of remediation presentation state.');
assert.match(uxSource, /presentationDeferred/,
  'Review UX must derive ownership from the remediation controller snapshot.');
assert.doesNotMatch(uxSource, /vocoraRemediationPreviewContinue/,
  'Review UX must not create a duplicate remediation Continue CTA.');

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
            <div class="remediation-heading"><span id="remediationKicker">اصلاح فوری</span><h3 id="remediationTitle">اشتباه را دقیق ببین</h3><p id="remediationDescription"></p></div>
            <div id="remediationComparison"><div>havnt</div><div>haven't</div></div>
            <p id="remediationHint"></p>
            <button id="remediationListenBtn" type="button">پخش تلفظ</button>
            <form id="remediationForm"><label for="remediationInput">املای کلمه</label><input id="remediationInput"><button type="submit">بررسی</button></form>
            <button id="remediationAcknowledgeBtn" type="button">متوجه شدم</button>
            <button id="remediationContinueBtn" type="button">ادامه</button>
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
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
const visualViewport = { height: 800, offsetTop: 0, addEventListener() {} };
Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });

let currentWord = { id: 'word-1', term: "haven't", accepted: ["haven't"], category: 'Test', box: 1 };
let remediationActive = null;
window.VazheyarTest = { getCurrentWord: () => currentWord };
window.VocoraPracticeRemediation = {
  snapshot: () => ({ active: remediationActive, queue: [] }),
  revealDeferredPresentation: () => {
    if (!remediationActive?.presentationDeferred) return false;
    remediationActive = { ...remediationActive, presentationDeferred: false };
    document.querySelector('#answerFeedback').classList.add('hidden');
    document.querySelector('#answerForm').classList.add('hidden');
    document.querySelector('#practiceRemediation').classList.remove('hidden', 'vocora-remediation-delayed');
    document.querySelector('#flashCard').classList.add('remediation-active');
    document.dispatchEvent(new window.CustomEvent('vocora:spelling-remediation-revealed'));
    return true;
  }
};

window.eval(uxSource);
const api = window.VocoraReviewSessionUx;
const controller = api.install(window, document);
assert.ok(controller);
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

function visible(element) {
  return !element.classList.contains('hidden');
}

function assertOnly(stageElement, message) {
  const visibleStages = [form, feedback, remediation].filter(visible);
  assert.deepEqual(visibleStages, [stageElement], message);
}

function assertStage(stage) {
  assert.equal(document.querySelector('#reviewSession').dataset.vocoraStage, stage);
  assert.equal(controller.getState().stage, stage);
  assert.equal(controller.getState().renderable, true, `${stage} must be renderable and exclusive.`);
}

function resetToAnswer() {
  remediationActive = null;
  remediation.className = 'practice-remediation hidden';
  flashCard.classList.remove('remediation-active');
  feedback.className = 'answer-feedback hidden';
  form.classList.remove('hidden');
  input.value = '';
  input.readOnly = false;
  controller.updatePrimaryState();
  controller.sync();
  assertStage('answer');
  assertOnly(form, 'Answer must be the only visible stage.');
}

function showFeedback({ answer, wrong = false }) {
  input.value = answer;
  form.classList.add('hidden');
  feedback.classList.remove('hidden');
  feedback.classList.toggle('wrong', wrong);
  controller.sync();
}

assert.match(document.querySelector('#vocora-review-session-ux-style')?.getAttribute('href') || '',
  /^review-session-ux\.css\?v=20260808-ownership3$/);
assert.equal(document.querySelector('#sessionAccuracy').parentElement.id, 'vocoraSessionAccuracy');
assertStage('answer');
assertOnly(form);

assert.equal(input.getAttribute('aria-label'), 'پاسخ');
assert.equal(input.nextElementSibling, primary);
assert.equal(primary.nextElementSibling, hint);
assert.equal(document.querySelectorAll('#vocoraDoubleTapHint').length, 1);
for (const spellingInput of [input, remediationInput]) {
  assert.equal(spellingInput.getAttribute('autocomplete'), 'off');
  assert.equal(spellingInput.getAttribute('autocorrect'), 'off');
  assert.equal(spellingInput.getAttribute('autocapitalize'), 'none');
  assert.equal(spellingInput.getAttribute('spellcheck'), 'false');
  assert.equal(spellingInput.getAttribute('data-lpignore'), 'true');
}

let skips = 0;
dontKnow.addEventListener('click', () => { skips += 1; });
primary.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
primary.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
assert.equal(skips, 1, 'Double tap must reuse the existing dontKnow business action once.');

showFeedback({ answer: '', wrong: true });
assertStage('feedback-warning');
assert.equal(title.textContent, 'اشکالی ندارد');
assert.equal(correctAnswer.textContent, "haven't");
assertOnly(feedback);

resetToAnswer();
showFeedback({ answer: 'havnt', wrong: true });
assertStage('feedback-wrong');
assert.equal(title.textContent, 'اشتباه بود');
assert.equal(detail.textContent, 'پاسخ درست را یک بار با دقت ببین.');
assertOnly(feedback);

resetToAnswer();
detail.textContent = 'از خانهٔ ۱ به خانهٔ ۲ رفت.';
showFeedback({ answer: "haven't", wrong: false });
assertStage('feedback-correct');
assert.equal(title.textContent, 'عالیه!');
assert.equal(detail.textContent, 'از خانهٔ ۱ به خانهٔ ۲ رفت.');
assertOnly(feedback);

// The exact reported race: remediation is active and even tries to expose its DOM,
// but persistent presentationDeferred state says feedback still owns the screen.
resetToAnswer();
showFeedback({ answer: 'havnt', wrong: true });
remediationActive = {
  wordId: 'word-1', phase: 'correction', context: 'immediate', recheckNumber: 0,
  presentationDeferred: true
};
remediation.classList.remove('hidden');
flashCard.classList.add('remediation-active');
controller.sync();
assertStage('feedback-wrong');
assert.equal(controller.getState().delayedRemediation, true);
assertOnly(feedback, 'Deferred correction must never coexist with wrong feedback.');
assert.ok(remediation.classList.contains('vocora-remediation-delayed'));
assert.ok(!flashCard.classList.contains('remediation-active'));

next.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
controller.sync();
assert.equal(remediationActive.presentationDeferred, false);
assertStage('remediation-correction');
assertOnly(remediation, 'Continue must atomically transfer ownership to correction.');

for (const phase of ['recall', 'copy', 'completed']) {
  remediationActive = { wordId: 'word-1', phase, context: 'immediate', recheckNumber: 0, presentationDeferred: false };
  remediation.classList.remove('hidden');
  controller.sync();
  assertStage(`remediation-${phase}`);
  assertOnly(remediation);
}

// Compatibility with an old cached adapter: no presentationDeferred field exists,
// but visible immediate feedback still has priority and the fallback Continue works.
resetToAnswer();
showFeedback({ answer: 'havnt', wrong: true });
remediationActive = { wordId: 'word-1', phase: 'correction', context: 'immediate', recheckNumber: 0 };
remediation.classList.remove('hidden');
flashCard.classList.add('remediation-active');
controller.sync();
assertStage('feedback-wrong');
assertOnly(feedback, 'A cached adapter must still not expose correction beside feedback.');
next.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
controller.sync();
assertStage('remediation-correction');
assertOnly(remediation);

// A late-loaded coordinator must derive deferred state from snapshot without
// relying on having observed the original start event.
remediationActive = { wordId: 'word-1', phase: 'correction', context: 'immediate', presentationDeferred: true };
feedback.classList.remove('hidden');
feedback.classList.add('wrong');
remediation.classList.remove('hidden');
controller.sync();
assertStage('feedback-wrong');
assertOnly(feedback);

// Blank-card recovery.
remediationActive = null;
form.classList.add('hidden');
feedback.classList.add('hidden');
remediation.classList.add('hidden');
flashCard.classList.add('remediation-active');
currentWord = { id: 'word-2', term: 'airport', accepted: ['airport'], category: 'Travel', box: 1 };
let recoveries = 0;
document.addEventListener('vocora:review-ui-recovered', () => { recoveries += 1; });
controller.sync();
assertStage('answer');
assertOnly(form);
assert.equal(recoveries, 1);
assert.ok(!flashCard.classList.contains('remediation-active'));

input.focus();
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'));
input.blur();
visualViewport.height = 520;
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'));
visualViewport.height = 800;
controller.syncVisualViewport();
assert.ok(!document.body.classList.contains('vocora-keyboard-open'));

const reviewView = document.querySelector('#view-review');
reviewView.classList.remove('active');
controller.sync();
assert.ok(!document.body.classList.contains('vocora-session-active'));

assert.match(cssSource, /body\.vocora-session-active \.sidebar[\s\S]*display:\s*none\s*!important/);
assert.match(cssSource, /#answerForm \.answer-label[\s\S]*clip-path:\s*inset\(50%\)/);
assert.match(cssSource, /#dontKnowBtn\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSource, /data-vocora-stage="feedback-wrong"[\s\S]*#answerFeedback/);
assert.match(cssSource, /data-vocora-stage\^="remediation-"[\s\S]*#practiceRemediation/);
assert.doesNotMatch(cssSource, /vocora-remediation-preview-continue/);

console.log('Unified review session component tests passed.');
