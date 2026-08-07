import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const uxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../review-session-ux.css', import.meta.url), 'utf8');
const guardSource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');

assert.match(guardSource, /review-session-ux\.js/, 'The pre-app keyboard guard must load the review UX module.');

const dom = new JSDOM(`<!doctype html>
<html lang="fa" dir="rtl">
<head></head>
<body>
  <div class="app-shell">
    <aside class="sidebar">nav</aside>
    <main class="main-content">
      <header class="topbar">global header</header>
      <section class="view active" id="view-review">
        <div id="reviewSession" class="review-session">
          <div class="session-bar">
            <button id="exitSessionBtn" class="icon-btn" type="button">×</button>
            <div class="session-progress">
              <div class="row-between">
                <span id="sessionCounter">کارت ۱ از ۱۰</span>
                <span id="sessionAccuracy">دقت: ۶۵٪</span>
              </div>
              <div class="progress-track"><i id="sessionProgressBar"></i></div>
            </div>
          </div>

          <article class="flash-card" id="flashCard">
            <div class="card-meta"><span id="cardCategory">Test</span><span id="cardBox">خانه ۱</span></div>
            <p class="instruction" id="cardInstruction">کلمه را بشنو و املای آن را بنویس.</p>
            <button id="listenWordBtn" type="button"><span>▶</span><small>پخش تلفظ</small></button>
            <button id="slowListenBtn" type="button">پخش آهسته‌تر</button>

            <form id="answerForm">
              <label class="answer-label" for="answerInput">پاسخ شما</label>
              <input id="answerInput" value="">
              <button class="btn btn-primary wide" type="submit">بررسی پاسخ</button>
            </form>
            <button id="dontKnowBtn" type="button">نمی‌دانم</button>

            <div id="answerFeedback" class="answer-feedback hidden">
              <div class="feedback-heading">
                <span id="feedbackIcon">✓</span>
                <div><strong id="feedbackTitle">درست بود!</strong><p id="feedbackDetail"></p></div>
              </div>
              <div class="correct-spelling"><small>املای صحیح</small><strong id="correctAnswer"></strong></div>
              <p id="wordNote"></p>
              <button id="nextCardBtn" class="btn btn-primary wide" type="button">کارت بعدی</button>
            </div>

            <section id="practiceRemediation" class="practice-remediation hidden">
              <button id="remediationAcknowledgeBtn" type="button">متوجه شدم</button>
            </section>
          </article>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`, {
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

window.VazheyarTest = {
  getCurrentWord: () => ({
    id: 'word-1',
    term: "haven't",
    accepted: ["haven't"],
    category: 'Test',
    box: 1
  })
};

window.eval(uxSource);
const api = window.VocoraReviewSessionUx;
assert.ok(api, 'Review session UX API must be exposed.');
const controller = api.install(window, document);
assert.ok(controller, 'Review session UX must install against the review DOM.');
controller.sync();

assert.equal(
  document.querySelector('#vocora-review-session-ux-style')?.getAttribute('href'),
  'review-session-ux.css',
  'The UX module must load its dedicated stylesheet.'
);
assert.ok(document.body.classList.contains('vocora-session-active'), 'Visible review session must enter focused session mode.');
assert.ok(document.documentElement.classList.contains('vocora-session-active'), 'The root element must also lock document scrolling.');

const accuracyBadge = document.querySelector('#vocoraSessionAccuracy');
assert.ok(accuracyBadge, 'Session accuracy must get a compact dedicated badge.');
assert.equal(
  document.querySelector('#sessionAccuracy').parentElement,
  accuracyBadge,
  'The existing accuracy element must be reused so app updates continue to work.'
);

const answerInput = document.querySelector('#answerInput');
const answerForm = document.querySelector('#answerForm');
const primary = answerForm.querySelector('button[type="submit"]');
const dontKnow = document.querySelector('#dontKnowBtn');
const feedback = document.querySelector('#answerFeedback');

assert.equal(answerInput.getAttribute('aria-label'), 'پاسخ', 'The visually hidden answer label must retain an accessible input name.');
assert.ok(primary.classList.contains('is-empty'), 'Empty answer must look disabled.');
assert.ok(document.querySelector('#vocoraDoubleTapHint'), 'Empty state must explain the double-tap shortcut.');
assert.ok(!primary.disabled, 'Primary action must remain technically clickable for the double-tap shortcut.');

let dontKnowClicks = 0;
dontKnow.addEventListener('click', () => { dontKnowClicks += 1; });

let firstTap = new window.MouseEvent('click', { bubbles: true, cancelable: true });
primary.dispatchEvent(firstTap);
assert.equal(firstTap.defaultPrevented, true, 'A single tap with an empty answer must not submit a wrong answer.');
assert.equal(dontKnowClicks, 0, 'A single empty tap must not mean "I do not know".');
assert.ok(primary.classList.contains('skip-armed'), 'First empty tap must visibly arm the shortcut.');

let secondTap = new window.MouseEvent('click', { bubbles: true, cancelable: true });
primary.dispatchEvent(secondTap);
assert.equal(secondTap.defaultPrevented, true);
assert.equal(dontKnowClicks, 1, 'Two quick taps with an empty answer must invoke the existing "I do not know" action exactly once.');

feedback.classList.remove('hidden');
feedback.classList.add('wrong');
controller.sync();
assert.ok(document.body.classList.contains('vocora-review-warning'), 'Double-tap skip must use the warning result state.');
assert.equal(document.querySelector('#feedbackTitle').textContent, 'اشکالی ندارد');
assert.equal(document.querySelector('#feedbackIcon').textContent, '!');
assert.equal(document.querySelector('#correctAnswer').textContent, "haven't", 'Warning state must still reveal the correct spelling.');
assert.equal(answerInput.readOnly, true, 'Answered input must be locked while feedback is open.');

feedback.classList.add('hidden');
feedback.classList.remove('wrong');
controller.sync();
assert.equal(answerInput.readOnly, false, 'Next-card state must unlock the input.');

answerInput.value = 'havnt';
answerInput.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.ok(!primary.classList.contains('is-empty'), 'Typing must activate the primary action.');
assert.ok(answerForm.classList.contains('vocora-has-answer'));
assert.equal(primary.textContent, 'بررسی پاسخ');

feedback.classList.remove('hidden');
feedback.classList.add('wrong');
document.querySelector('#feedbackTitle').textContent = 'legacy wrong title';
document.querySelector('#feedbackDetail').textContent = 'legacy detail';
document.querySelector('#correctAnswer').textContent = '';
controller.sync();
assert.ok(document.body.classList.contains('vocora-review-wrong'), 'Wrong answer must use the red result state.');
assert.ok(answerInput.classList.contains('vocora-answer-wrong'), 'Wrong answer must mark the original input red.');
assert.equal(document.querySelector('#feedbackTitle').textContent, 'اشتباه بود');
assert.equal(document.querySelector('#feedbackDetail').textContent, 'پاسخ درست را یک بار با دقت ببین.');
assert.equal(document.querySelector('#nextCardBtn').textContent, 'ادامه');
assert.equal(document.querySelector('#correctAnswer').textContent, "haven't");

feedback.classList.add('hidden');
feedback.classList.remove('wrong');
controller.sync();
answerInput.value = "haven't";
answerInput.dispatchEvent(new window.Event('input', { bubbles: true }));
feedback.classList.remove('hidden');
document.querySelector('#feedbackTitle').textContent = 'درست بود!';
document.querySelector('#feedbackDetail').textContent = 'از خانهٔ ۱ به خانهٔ ۲ رفت.';
controller.sync();
assert.ok(document.body.classList.contains('vocora-review-correct'), 'Correct answer must use the green result state.');
assert.ok(answerInput.classList.contains('vocora-answer-correct'), 'Correct answer must keep the submitted spelling visible in green.');
assert.equal(document.querySelector('#feedbackTitle').textContent, 'عالیه!');
assert.equal(
  document.querySelector('#feedbackDetail').textContent,
  'از خانهٔ ۱ به خانهٔ ۲ رفت.',
  'Useful Leitner transition detail must be preserved on a correct answer.'
);

feedback.classList.add('hidden');
controller.sync();
answerInput.value = 'havnt';
feedback.classList.remove('hidden');
feedback.classList.add('wrong');
document.querySelector('#correctAnswer').textContent = '';
document.querySelector('#practiceRemediation').classList.remove('hidden');
document.querySelector('#flashCard').classList.add('remediation-active');

document.dispatchEvent(new window.CustomEvent('vocora:spelling-remediation-started', {
  detail: { wordId: 'word-1', mode: 'box1', context: 'immediate' }
}));
controller.sync();

assert.equal(controller.getState().delayedRemediation, true, 'Immediate remediation must wait until the wrong result is acknowledged.');
assert.ok(!document.querySelector('#flashCard').classList.contains('remediation-active'), 'Wrong result must remain visible before correction begins.');
assert.ok(document.querySelector('#practiceRemediation').classList.contains('vocora-remediation-delayed'));
const previewContinue = document.querySelector('#vocoraRemediationPreviewContinue');
assert.ok(previewContinue && !previewContinue.classList.contains('hidden'), 'Wrong result must have a dedicated Continue action into remediation.');
assert.equal(document.querySelector('#correctAnswer').textContent, "haven't", 'Remediation clearing must not erase the answer from the red preview.');

previewContinue.click();
assert.equal(controller.getState().delayedRemediation, false);
assert.ok(document.querySelector('#flashCard').classList.contains('remediation-active'), 'Continue must reveal the existing correction workflow.');
assert.ok(!document.querySelector('#practiceRemediation').classList.contains('vocora-remediation-delayed'));

document.querySelector('#flashCard').classList.remove('remediation-active');
document.querySelector('#practiceRemediation').classList.add('hidden');
feedback.classList.add('hidden');
controller.sync();

answerInput.focus();
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'), 'Focusing a practice input must enter the compact keyboard layout.');
answerInput.blur();
visualViewport.height = 520;
controller.syncVisualViewport();
assert.ok(document.body.classList.contains('vocora-keyboard-open'), 'A materially reduced visual viewport must keep keyboard mode active.');

visualViewport.height = 800;
controller.syncVisualViewport();
assert.ok(!document.body.classList.contains('vocora-keyboard-open'), 'Restored visual viewport must leave keyboard mode.');

document.querySelector('#reviewSession').classList.add('hidden');
controller.sync();
assert.ok(!document.body.classList.contains('vocora-session-active'), 'Leaving the session must restore the normal application shell.');
assert.ok(!document.documentElement.classList.contains('vocora-session-active'), 'Leaving the session must unlock root scrolling.');

assert.match(cssSource, /body\.vocora-session-active \.sidebar[\s\S]*display:\s*none\s*!important/, 'Mobile session CSS must hide the bottom/sidebar navigation.');
assert.match(cssSource, /body\.vocora-session-active[\s\S]*position:\s*fixed/, 'The mobile session must be locked to the visual viewport.');
assert.match(cssSource, /#answerForm \.answer-label[\s\S]*clip-path:\s*inset\(50%\)/, 'The visible "پاسخ شما" label must be removed without harming accessibility.');
assert.match(cssSource, /#dontKnowBtn[\s\S]*display:\s*none\s*!important/, 'The separate "نمی‌دانم" control must be visually removed.');
assert.match(cssSource, /vocora-keyboard-open[\s\S]*#answerForm/, 'The stylesheet must include a dedicated keyboard-open layout.');
assert.match(cssSource, /vocora-review-wrong[\s\S]*#answerFeedback/, 'The stylesheet must define a wrong-answer result sheet.');
assert.match(cssSource, /vocora-review-correct[\s\S]*#answerFeedback/, 'The stylesheet must define a correct-answer result sheet.');
assert.match(cssSource, /vocora-review-warning[\s\S]*#answerFeedback/, 'The stylesheet must define an "I do not know" warning result sheet.');

console.log('Review session UX tests passed.');
