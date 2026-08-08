import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const domainSource = fs.readFileSync(new URL('../practice-remediation.js', import.meta.url), 'utf8');
const routerSource = fs.readFileSync(new URL('../practice-session-keyboard-router.js', import.meta.url), 'utf8');
const compatibilitySource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');
const adapterSource = fs.readFileSync(new URL('../practice-remediation-adapter.js', import.meta.url), 'utf8');
const reviewUxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

assert.match(routerSource, /windowObject\.addEventListener\('keydown', handler, true\)/);
assert.match(compatibilitySource, /practice-session-keyboard-router\.js\?v=/,
  'Previously cached HTML must be upgraded to the new window router.');
assert.doesNotMatch(adapterSource, /clearOriginalFeedbackContent/,
  'The remediation view must never erase the primary feedback component.');
assert.match(adapterSource, /presentActiveRemediation/,
  'Feedback-to-remediation transfer must be one explicit controller transition.');

function markup() {
  return `<!doctype html><html lang="fa" dir="rtl"><head></head><body>
    <button id="boxOnePracticeBtn" type="button">تمرین خانه ۱</button>
    <section class="view active" id="view-review">
      <div id="reviewSession">
        <div class="session-bar">
          <button id="exitSessionBtn" type="button">×</button>
          <div class="session-progress"><div class="row-between"><span id="sessionCounter">تمرین آزاد · ۰ پاسخ</span><span id="sessionAccuracy">دقت: ۰٪</span></div><div class="progress-track"><i></i></div></div>
        </div>
        <article id="flashCard">
          <div class="card-meta"><span id="cardCategory">Modern families</span><span id="cardBox">خانه ۱</span></div>
          <p id="cardInstruction">تمرین آزاد خانهٔ ۱؛ این پاسخ جای کارت را تغییر نمی‌دهد.</p>
          <button id="listenWordBtn" type="button"><span>▶</span><small>پخش تلفظ</small></button>
          <button id="slowListenBtn" type="button">پخش آهسته‌تر</button>
          <form id="answerForm"><label class="answer-label" for="answerInput">پاسخ شما</label><input id="answerInput"><button type="submit">بررسی پاسخ</button></form>
          <button id="dontKnowBtn" type="button">نمی‌دانم</button>
          <div id="answerFeedback" class="answer-feedback hidden">
            <div class="feedback-heading"><span id="feedbackIcon">×</span><div><strong id="feedbackTitle">اشتباه بود</strong><p id="feedbackDetail"></p></div></div>
            <div class="correct-spelling"><small>املای صحیح</small><strong id="correctAnswer"></strong></div>
            <p id="wordNote"></p><button id="nextCardBtn" type="button">ادامه</button>
          </div>
        </article>
      </div>
    </section>
  </body></html>`;
}

function configureWindow(window) {
  window.scrollTo = () => {};
  window.VazheyarReady = Promise.resolve();
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.speechSynthesis = { cancel() {}, speak() {}, getVoices() { return []; } };
  window.VazheyarTest = {
    getCurrentWord: () => ({
      id: 'imaginative', term: 'imaginative', accepted: ['imaginative'],
      category: 'Modern families', box: 1, notes: ''
    }),
    getState: () => ({ settings: { voiceRate: 0.85 } }),
    isCorrectAnswer: (answer, word = null) => {
      const target = word?.accepted?.[0] || 'imaginative';
      return String(answer || '').trim().toLowerCase() === String(target).toLowerCase();
    }
  };
}

function installPrimaryAppBehavior(document, window) {
  const metrics = { nextCards: 0 };
  document.querySelector('#answerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = document.querySelector('#answerInput').value;
    const correct = window.VazheyarTest.isCorrectAnswer(answer);
    document.querySelector('#answerForm').classList.add('hidden');
    document.querySelector('#dontKnowBtn').classList.add('hidden');
    document.querySelector('#answerFeedback').classList.remove('hidden');
    document.querySelector('#answerFeedback').classList.toggle('wrong', !correct);
    document.querySelector('#feedbackTitle').textContent = correct ? 'درست بود!' : 'اشتباه بود';
    document.querySelector('#feedbackDetail').textContent = correct
      ? 'تمرین ثبت شد؛ تمرین آزاد جای کارت‌های قبلی را تغییر نمی‌دهد.'
      : 'پاسخ درست را یک بار با دقت ببین.';
    document.querySelector('#correctAnswer').textContent = 'imaginative';
  });
  document.querySelector('#nextCardBtn').addEventListener('click', () => {
    metrics.nextCards += 1;
    document.querySelector('#answerFeedback').classList.add('hidden');
    document.querySelector('#answerForm').classList.remove('hidden');
    document.querySelector('#dontKnowBtn').classList.remove('hidden');
  });
  return metrics;
}

async function createHarness({ reviewTiming = 'before-adapter' } = {}) {
  const dom = new JSDOM(markup(), {
    url: 'https://vocora.test/#review',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  configureWindow(window);
  const metrics = installPrimaryAppBehavior(document, window);

  window.eval(routerSource);
  window.eval(domainSource);
  if (reviewTiming === 'before-adapter') window.eval(reviewUxSource);
  window.eval(adapterSource);
  const remediation = await window.VocoraPracticeRemediationReady;
  let review = reviewTiming === 'before-adapter'
    ? window.VocoraReviewSessionUx.install(window, document)
    : null;

  document.querySelector('#boxOnePracticeBtn').click();

  return {
    dom, window, document, remediation, metrics,
    get review() { return review; },
    loadReview() {
      if (!window.VocoraReviewSessionUx) window.eval(reviewUxSource);
      review = window.VocoraReviewSessionUx.install(window, document);
      review.sync();
      return review;
    }
  };
}

async function submitAnswer(harness, answer) {
  harness.document.querySelector('#answerInput').value = answer;
  harness.document.querySelector('#answerForm').dispatchEvent(
    new harness.window.Event('submit', { bubbles: true, cancelable: true })
  );
  await tick();
  await tick();
}

async function submitWrong(harness) {
  await submitAnswer(harness, 'imagenitive');
}

async function submitCorrect(harness) {
  await submitAnswer(harness, 'imaginative');
}

function pressEnter(harness, element = harness.document.body) {
  const event = new harness.window.KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', bubbles: true, cancelable: true
  });
  element.dispatchEvent(event);
  return event;
}

function assertFeedbackOnly(harness, message) {
  const feedback = harness.document.querySelector('#answerFeedback');
  const root = harness.document.querySelector('#practiceRemediation');
  assert.ok(!feedback.classList.contains('hidden'), message);
  assert.ok(root.classList.contains('hidden'), message);
  assert.ok(!harness.document.querySelector('#flashCard').classList.contains('remediation-active'), message);
}

function assertRemediationOnly(harness, message) {
  const feedback = harness.document.querySelector('#answerFeedback');
  const root = harness.document.querySelector('#practiceRemediation');
  assert.ok(feedback.classList.contains('hidden'), message);
  assert.ok(!root.classList.contains('hidden'), message);
  assert.ok(harness.document.querySelector('#flashCard').classList.contains('remediation-active'), message);
  assert.equal(root.hasAttribute('inert'), false, `${message} Remediation must be interactive.`);
  assert.equal(root.getAttribute('aria-hidden'), 'false', `${message} Remediation must be exposed to assistive technology.`);
}

async function enterFeedbackThenCorrection(harness, prefix) {
  const feedbackEnter = pressEnter(harness);
  assert.equal(feedbackEnter.defaultPrevented, true, `${prefix}: feedback Enter must be owned.`);
  await tick();
  assert.equal(harness.remediation.snapshot().active?.presentationDeferred, false);
  assert.equal(harness.remediation.snapshot().active?.phase, 'correction');
  assertRemediationOnly(harness, `${prefix}: feedback Enter must reveal only correction.`);

  const correctionEnter = pressEnter(harness);
  assert.equal(correctionEnter.defaultPrevented, true, `${prefix}: correction Enter must be owned.`);
  await tick();
  assert.equal(harness.remediation.snapshot().active?.phase, 'recall',
    `${prefix}: correction Enter must invoke the real acknowledgement action.`);
  const root = harness.document.querySelector('#practiceRemediation');
  assert.ok(!root.classList.contains('hidden'));
  assert.ok(!harness.document.querySelector('#remediationForm').classList.contains('hidden'));
}

const adapterOnly = await createHarness({ reviewTiming: 'after-wrong' });
await submitWrong(adapterOnly);
assert.equal(adapterOnly.remediation.snapshot().active?.phase, 'correction');
assert.equal(adapterOnly.remediation.snapshot().active?.presentationDeferred, true);
assertFeedbackOnly(adapterOnly, 'Adapter alone must keep correction hidden before Continue.');
await enterFeedbackThenCorrection(adapterOnly, 'adapter-only');
adapterOnly.dom.window.close();

const integrated = await createHarness({ reviewTiming: 'before-adapter' });
await submitWrong(integrated);
integrated.review.sync();
assert.equal(integrated.review.getState().stage, 'feedback-wrong');
assert.equal(integrated.review.getState().delayedRemediation, true);
assertFeedbackOnly(integrated, 'Integrated feedback must be exclusive.');
for (let index = 0; index < 3; index += 1) {
  integrated.review.sync();
  integrated.remediation.render();
  await tick();
  assertFeedbackOnly(integrated, 'Repeated render/sync attempts cannot expose correction early.');
}
await enterFeedbackThenCorrection(integrated, 'integrated');
integrated.review.sync();
assert.equal(integrated.review.getState().stage, 'remediation-recall');
integrated.dom.window.close();

const lateReview = await createHarness({ reviewTiming: 'after-wrong' });
await submitWrong(lateReview);
assert.equal(lateReview.remediation.snapshot().active?.presentationDeferred, true);
lateReview.loadReview();
assert.equal(lateReview.review.getState().stage, 'feedback-wrong');
assert.equal(lateReview.review.getState().delayedRemediation, true);
assertFeedbackOnly(lateReview, 'Late coordinator load must still keep feedback exclusive.');
await enterFeedbackThenCorrection(lateReview, 'late-review');
lateReview.review.sync();
assert.equal(lateReview.review.getState().stage, 'remediation-recall');
lateReview.dom.window.close();

// Exact regression from production: after several primary cards, a due recheck is
// taken while a correct-feedback screen is visible. Previously startRecheck rendered
// remediation without hiding feedback; the review component then chose feedback,
// the remediation view erased #correctAnswer, and both click and Enter deadlocked.
const dueRecheck = await createHarness({ reviewTiming: 'before-adapter' });
const recheckWord = {
  id: 'accommodation', term: 'accommodation', accepted: ['accommodation'],
  category: 'Modern families', box: 1, notes: ''
};
dueRecheck.remediation.queue.schedule({
  word: recheckWord,
  mode: 'box1',
  recheckNumber: 1,
  originId: null
}, 1);
await submitCorrect(dueRecheck);
dueRecheck.review.sync();
assert.equal(dueRecheck.review.getState().stage, 'feedback-correct');
assertFeedbackOnly(dueRecheck, 'Correct feedback must be stable before Continue.');
assert.equal(dueRecheck.document.querySelector('#correctAnswer').textContent, 'imaginative');

// Real mouse path: Continue is intercepted once and atomically transfers ownership
// to the due recheck instead of leaving a dead correct-feedback card behind.
dueRecheck.document.querySelector('#nextCardBtn').click();
await tick();
dueRecheck.review.sync();
assert.equal(dueRecheck.remediation.snapshot().active?.context, 'recheck');
assert.equal(dueRecheck.remediation.snapshot().active?.phase, 'recall');
assert.equal(dueRecheck.review.getState().stage, 'remediation-recall');
assertRemediationOnly(dueRecheck, 'A due recheck must own the screen after Continue.');
assert.equal(dueRecheck.metrics.nextCards, 0, 'The underlying primary card must not advance before the recheck.');
assert.equal(
  dueRecheck.document.querySelector('#correctAnswer').textContent,
  'imaginative',
  'Rendering remediation must never destructively erase the primary feedback content.'
);

// Real keyboard path remains interactive through recall and completion.
const recheckInput = dueRecheck.document.querySelector('#remediationInput');
let event = pressEnter(dueRecheck);
assert.equal(event.defaultPrevented, true);
assert.equal(dueRecheck.document.activeElement, recheckInput, 'Empty recheck Enter must focus the spelling input.');
recheckInput.value = 'accommodation';
event = pressEnter(dueRecheck, recheckInput);
assert.equal(event.defaultPrevented, true);
await tick();
assert.equal(dueRecheck.remediation.snapshot().active?.phase, 'completed');
assert.equal(dueRecheck.review.syncStableStage(), 'remediation-completed');
assertRemediationOnly(dueRecheck, 'Completed recheck must remain interactive.');
event = pressEnter(dueRecheck);
assert.equal(event.defaultPrevented, true);
await tick();
assert.equal(dueRecheck.remediation.snapshot().active, null);
assert.equal(dueRecheck.metrics.nextCards, 1, 'Completing the recheck must advance the primary session exactly once.');
dueRecheck.dom.window.close();

console.log('Review/remediation ownership integration tests passed.');
