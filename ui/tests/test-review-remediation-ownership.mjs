import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const domainSource = fs.readFileSync(new URL('../practice-remediation.js', import.meta.url), 'utf8');
const adapterSource = fs.readFileSync(new URL('../practice-remediation-adapter.js', import.meta.url), 'utf8');
const reviewUxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    isCorrectAnswer: (answer) => String(answer || '').trim().toLowerCase() === 'imaginative'
  };
}

function installPrimaryAppBehavior(document, window) {
  document.querySelector('#answerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = document.querySelector('#answerInput').value;
    const correct = window.VazheyarTest.isCorrectAnswer(answer);
    document.querySelector('#answerForm').classList.add('hidden');
    document.querySelector('#dontKnowBtn').classList.add('hidden');
    document.querySelector('#answerFeedback').classList.remove('hidden');
    document.querySelector('#answerFeedback').classList.toggle('wrong', !correct);
    document.querySelector('#feedbackTitle').textContent = correct ? 'درست بود!' : 'اشتباه بود';
    document.querySelector('#correctAnswer').textContent = 'imaginative';
  });
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
  installPrimaryAppBehavior(document, window);
  window.eval(domainSource);

  if (reviewTiming === 'before-adapter') window.eval(reviewUxSource);
  window.eval(adapterSource);
  const remediation = await window.VocoraPracticeRemediationReady;
  let review = reviewTiming === 'before-adapter'
    ? window.VocoraReviewSessionUx.install(window, document)
    : null;

  document.querySelector('#boxOnePracticeBtn').click();

  return {
    dom, window, document, remediation,
    get review() { return review; },
    loadReview() {
      if (!window.VocoraReviewSessionUx) window.eval(reviewUxSource);
      review = window.VocoraReviewSessionUx.install(window, document);
      review.sync();
      return review;
    }
  };
}

async function submitWrong(harness) {
  harness.document.querySelector('#answerInput').value = 'imagenitive';
  harness.document.querySelector('#answerForm').dispatchEvent(
    new harness.window.Event('submit', { bubbles: true, cancelable: true })
  );
  await tick();
  await tick();
}

function assertFeedbackOnly(harness, message) {
  const feedback = harness.document.querySelector('#answerFeedback');
  const root = harness.document.querySelector('#practiceRemediation');
  assert.ok(!feedback.classList.contains('hidden'), message);
  assert.ok(root.classList.contains('hidden'), message);
  assert.ok(!harness.document.querySelector('#flashCard').classList.contains('remediation-active'), message);
}

function assertCorrectionOnly(harness, message) {
  const feedback = harness.document.querySelector('#answerFeedback');
  const root = harness.document.querySelector('#practiceRemediation');
  assert.ok(feedback.classList.contains('hidden'), message);
  assert.ok(!root.classList.contains('hidden'), message);
  assert.ok(harness.document.querySelector('#flashCard').classList.contains('remediation-active'), message);
}

// Adapter source of truth: correction state may exist, but its presentation cannot
// render before the primary feedback Continue action.
const adapterOnly = await createHarness({ reviewTiming: 'after-wrong' });
await submitWrong(adapterOnly);
assert.equal(adapterOnly.remediation.snapshot().active?.phase, 'correction');
assert.equal(adapterOnly.remediation.snapshot().active?.presentationDeferred, true);
assertFeedbackOnly(adapterOnly, 'Adapter alone must keep correction hidden before Continue.');
adapterOnly.document.querySelector('#nextCardBtn').click();
await tick();
assert.equal(adapterOnly.remediation.snapshot().active?.presentationDeferred, false);
assertCorrectionOnly(adapterOnly, 'Adapter Continue must atomically reveal correction.');
adapterOnly.dom.window.close();

// Normal production order: review coordinator is installed before adapter boot.
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
integrated.document.querySelector('#nextCardBtn').click();
await tick();
integrated.review.sync();
assert.equal(integrated.review.getState().stage, 'remediation-correction');
assertCorrectionOnly(integrated, 'Continue must transfer ownership exactly once.');
integrated.dom.window.close();

// Critical regression: a slow or previously cached review coordinator can load
// after the remediation-started event. It must derive ownership from the persistent
// controller snapshot instead of depending on the missed event.
const lateReview = await createHarness({ reviewTiming: 'after-wrong' });
await submitWrong(lateReview);
assert.equal(lateReview.remediation.snapshot().active?.presentationDeferred, true);
lateReview.loadReview();
assert.equal(lateReview.review.getState().stage, 'feedback-wrong');
assert.equal(lateReview.review.getState().delayedRemediation, true);
assertFeedbackOnly(lateReview, 'Late coordinator load must still keep feedback exclusive.');
lateReview.document.querySelector('#nextCardBtn').click();
await tick();
lateReview.review.sync();
assert.equal(lateReview.remediation.snapshot().active?.presentationDeferred, false);
assert.equal(lateReview.review.getState().stage, 'remediation-correction');
assertCorrectionOnly(lateReview, 'Late-loaded coordinator must transition cleanly on Continue.');
lateReview.dom.window.close();

console.log('Review/remediation ownership integration tests passed.');
