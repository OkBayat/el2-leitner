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
          <div class="session-progress">
            <div class="row-between"><span id="sessionCounter">تمرین آزاد · ۰ پاسخ</span><span id="sessionAccuracy">دقت: ۰٪</span></div>
            <div class="progress-track"><i id="sessionProgressBar"></i></div>
          </div>
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
            <p id="wordNote"></p>
            <button id="nextCardBtn" type="button">ادامه</button>
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
      id: 'imaginative',
      term: 'imaginative',
      accepted: ['imaginative'],
      category: 'Modern families',
      box: 1,
      notes: ''
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

async function createHarness({ withReviewUx }) {
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
  if (withReviewUx) window.eval(reviewUxSource);
  window.eval(adapterSource);
  const remediation = await window.VocoraPracticeRemediationReady;
  const review = withReviewUx ? window.VocoraReviewSessionUx.install(window, document) : null;

  document.querySelector('#boxOnePracticeBtn').click();
  return { dom, window, document, remediation, review };
}

async function submitWrong(harness) {
  harness.document.querySelector('#answerInput').value = 'imagenitive';
  harness.document.querySelector('#answerForm').dispatchEvent(
    new harness.window.Event('submit', { bubbles: true, cancelable: true })
  );
  await tick();
  await tick();
}

// Source-level invariant: even without review-session-ux, the remediation adapter
// must not render its correction page before the primary wrong-result Continue.
const adapterOnly = await createHarness({ withReviewUx: false });
await submitWrong(adapterOnly);
let root = adapterOnly.document.querySelector('#practiceRemediation');
assert.equal(adapterOnly.remediation.snapshot().active?.phase, 'correction');
assert.equal(adapterOnly.remediation.snapshot().active?.presentationDeferred, true);
assert.ok(root.classList.contains('hidden'), 'Adapter alone must keep correction DOM hidden while wrong feedback owns the screen.');
assert.ok(root.classList.contains('vocora-remediation-delayed'));
assert.ok(!adapterOnly.document.querySelector('#answerFeedback').classList.contains('hidden'));
assert.ok(!adapterOnly.document.querySelector('#flashCard').classList.contains('remediation-active'));

adapterOnly.document.querySelector('#nextCardBtn').click();
await tick();
assert.equal(adapterOnly.remediation.snapshot().active?.presentationDeferred, false);
assert.ok(adapterOnly.document.querySelector('#answerFeedback').classList.contains('hidden'));
assert.ok(!root.classList.contains('hidden'));
assert.ok(adapterOnly.document.querySelector('#flashCard').classList.contains('remediation-active'));
adapterOnly.dom.window.close();

// Full production ownership: review UX and adapter cooperate, but there is still
// exactly one visible stage before and after Continue.
const integrated = await createHarness({ withReviewUx: true });
await submitWrong(integrated);
root = integrated.document.querySelector('#practiceRemediation');
integrated.review.sync();

assert.equal(integrated.remediation.snapshot().active?.presentationDeferred, true);
assert.equal(integrated.review.getState().stage, 'feedback-wrong');
assert.ok(!integrated.document.querySelector('#answerFeedback').classList.contains('hidden'));
assert.ok(root.classList.contains('hidden'));
assert.ok(!integrated.document.querySelector('#flashCard').classList.contains('remediation-active'));

// Re-running every synchronizer while feedback is visible must not expose correction.
for (let index = 0; index < 3; index += 1) {
  integrated.review.sync();
  integrated.remediation.render();
  await tick();
  assert.ok(root.classList.contains('hidden'), 'Deferred render attempts must remain no-ops.');
  assert.ok(!integrated.document.querySelector('#answerFeedback').classList.contains('hidden'));
}

integrated.document.querySelector('#nextCardBtn').click();
await tick();
integrated.review.sync();
assert.equal(integrated.remediation.snapshot().active?.presentationDeferred, false);
assert.equal(integrated.review.getState().stage, 'remediation-correction');
assert.ok(integrated.document.querySelector('#answerFeedback').classList.contains('hidden'));
assert.ok(!root.classList.contains('hidden'));
assert.ok(integrated.document.querySelector('#flashCard').classList.contains('remediation-active'));

integrated.dom.window.close();
console.log('Review/remediation ownership integration tests passed.');
