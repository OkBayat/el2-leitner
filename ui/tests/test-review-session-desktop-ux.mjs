import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const uxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../review-session-ux.css', import.meta.url), 'utf8');

const dom = new JSDOM(`<!doctype html><html lang="fa" dir="rtl"><head></head><body>
  <section class="view active" id="view-review">
    <div id="reviewSession" class="review-session">
      <div class="session-bar">
        <button id="exitSessionBtn">×</button>
        <div class="session-progress"><div class="row-between"><span id="sessionCounter">تمرین آزاد · ۲ پاسخ</span><span id="sessionAccuracy">دقت: ۷۵٪</span></div><div class="progress-track"><i id="sessionProgressBar"></i></div></div>
      </div>
      <article id="flashCard" class="flash-card">
        <div class="card-meta"><span id="cardCategory">University and study</span><span id="cardBox">خانه ۱</span></div>
        <p id="cardInstruction">تمرین آزاد خانهٔ ۱؛ این پاسخ جای کارت را تغییر نمی‌دهد.</p>
        <button id="listenWordBtn"><span>▶</span><small>پخش تلفظ</small></button>
        <button id="slowListenBtn">پخش آهسته‌تر</button>
        <form id="answerForm"><label class="answer-label" for="answerInput">پاسخ شما</label><input id="answerInput"><button class="btn btn-primary wide" type="submit">بررسی پاسخ</button></form>
        <button id="dontKnowBtn">نمی‌دانم</button>
        <div id="answerFeedback" class="answer-feedback hidden">
          <div class="feedback-heading"><span id="feedbackIcon">×</span><div><strong id="feedbackTitle">اشتباه بود</strong><p id="feedbackDetail"></p></div></div>
          <div class="correct-spelling"><small>املای صحیح</small><strong id="correctAnswer"></strong></div>
          <p id="wordNote"></p><button id="nextCardBtn">ادامه</button>
        </div>
        <section id="practiceRemediation" class="practice-remediation hidden">
          <div class="remediation-heading"><span class="remediation-kicker">اصلاح فوری</span><h3>اشتباه را دقیق ببین</h3><p>تفاوت پاسخ را بررسی کن.</p></div>
          <button id="remediationAcknowledgeBtn">متوجه شدم</button>
        </section>
      </article>
    </div>
  </section>
</body></html>`, {
  url: 'https://vocora.test/#review',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });

let remediationSnapshot = null;
window.VazheyarTest = {
  getCurrentWord: () => ({ id: 'specialist', term: 'specialist', accepted: ['specialist'], category: 'University and study', box: 1 })
};
window.VocoraPracticeRemediation = {
  snapshot: () => ({ active: remediationSnapshot })
};

window.eval(uxSource);
const controller = window.VocoraReviewSessionUx.install(window, document);
assert.ok(controller, 'Unified practice component must install on desktop.');
controller.sync();

const input = document.querySelector('#answerInput');
const primary = document.querySelector('#answerForm button[type="submit"]');
const hint = document.querySelector('#vocoraDoubleTapHint');
assert.ok(hint, 'Double-tap hint must exist exactly once.');
assert.equal(document.querySelectorAll('#vocoraDoubleTapHint').length, 1);
assert.equal(input.nextElementSibling, primary, 'Primary button must directly follow the input.');
assert.equal(primary.nextElementSibling, hint, 'Hint must be below the primary button in DOM order.');

const baseCss = cssSource.slice(0, cssSource.indexOf('@media (max-width:760px)'));
assert.match(
  baseCss,
  /data-vocora-stage\^="feedback-"\]\s+#practiceRemediation[\s\S]*display:\s*none\s*!important/,
  'Feedback/remediation exclusivity must apply on desktop, not only inside the mobile media query.'
);
assert.match(
  cssSource,
  /grid-template-rows:\s*72px\s+58px\s+auto/,
  'Mobile answer stack must render input, button, then hint.'
);
assert.match(
  cssSource,
  /grid-template-rows:\s*60px\s+52px\s+auto/,
  'Keyboard/short-height stack must preserve input, button, then hint.'
);

const form = document.querySelector('#answerForm');
const feedback = document.querySelector('#answerFeedback');
const remediation = document.querySelector('#practiceRemediation');
const flashCard = document.querySelector('#flashCard');

form.classList.add('hidden');
feedback.classList.remove('hidden');
feedback.classList.add('wrong');
remediation.classList.remove('hidden');
flashCard.classList.add('remediation-active');
remediationSnapshot = { wordId: 'specialist', phase: 'correction', context: 'immediate', recheckNumber: 0 };

document.dispatchEvent(new window.CustomEvent('vocora:spelling-remediation-started', {
  detail: { wordId: 'specialist', mode: 'box1', context: 'immediate' }
}));
controller.sync();

assert.equal(controller.getState().delayedRemediation, true, 'Immediate remediation must wait behind the wrong-result stage on desktop.');
assert.equal(controller.getState().stage, 'feedback-wrong');
assert.ok(remediation.classList.contains('vocora-remediation-delayed'));
assert.ok(!flashCard.classList.contains('remediation-active'), 'Feedback stage must not inherit the remediation-only hiding class.');
assert.equal(document.querySelector('#feedbackTitle').textContent, 'اشتباه بود');
assert.equal(document.querySelector('#correctAnswer').textContent, 'specialist');

const next = document.querySelector('#nextCardBtn');
next.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
controller.sync();
assert.equal(controller.getState().delayedRemediation, false);
assert.equal(controller.getState().stage, 'remediation-correction', 'Continue must switch to correction instead of rendering both stages together.');
assert.ok(!remediation.classList.contains('vocora-remediation-delayed'));
assert.ok(flashCard.classList.contains('remediation-active'));

// Explicitly dispose the visual JSDOM window so rAF/observer resources from the
// component can never keep this regression test process alive after assertions.
window.close();
console.log('Desktop review session UX tests passed.');
