import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const uxSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../review-session-ux.css', import.meta.url), 'utf8');
const guardSource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');
assert.match(guardSource, /review-session-ux\.js/, 'Keyboard guard must load review UX before practice interaction.');

const dom = new JSDOM(`<!doctype html><html lang="fa" dir="rtl"><head></head><body>
<div class="app-shell"><aside class="sidebar">nav</aside><main class="main-content"><header class="topbar">header</header>
<section class="view active" id="view-review"><div id="reviewSession" class="review-session">
<div class="session-bar"><button id="exitSessionBtn">×</button><div class="session-progress"><div class="row-between"><span id="sessionCounter">کارت ۱ از ۱۰</span><span id="sessionAccuracy">دقت: ۶۵٪</span></div><div class="progress-track"><i id="sessionProgressBar"></i></div></div></div>
<article id="flashCard" class="flash-card"><div class="card-meta"><span id="cardCategory">Test</span><span id="cardBox">خانه ۱</span></div><p id="cardInstruction">کلمه را بشنو و املای آن را بنویس.</p><button id="listenWordBtn"><span>▶</span><small>پخش تلفظ</small></button><button id="slowListenBtn">پخش آهسته‌تر</button>
<form id="answerForm"><label class="answer-label" for="answerInput">پاسخ شما</label><input id="answerInput"><button class="btn btn-primary wide" type="submit">بررسی پاسخ</button></form><button id="dontKnowBtn">نمی‌دانم</button>
<div id="answerFeedback" class="answer-feedback hidden"><div class="feedback-heading"><span id="feedbackIcon">✓</span><div><strong id="feedbackTitle">درست بود!</strong><p id="feedbackDetail"></p></div></div><div class="correct-spelling"><small>املای صحیح</small><strong id="correctAnswer"></strong></div><p id="wordNote"></p><button id="nextCardBtn">کارت بعدی</button></div>
<section id="practiceRemediation" class="practice-remediation hidden"><button id="remediationAcknowledgeBtn">متوجه شدم</button></section></article>
</div></section></main></div></body></html>`, { url:'https://vocora.test/#review', runScripts:'outside-only', pretendToBeVisual:true });

const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
Object.defineProperty(window, 'scrollY', { configurable:true, value:0 });
const visualViewport = { height:800, offsetTop:0, addEventListener() {} };
Object.defineProperty(window, 'visualViewport', { configurable:true, value:visualViewport });
Object.defineProperty(window, 'innerHeight', { configurable:true, value:800 });
window.VazheyarTest = { getCurrentWord:() => ({ id:'word-1', term:"haven't", accepted:["haven't"], category:'Test', box:1 }) };

window.eval(uxSource);
const controller = window.VocoraReviewSessionUx.install(window, document);
assert.ok(controller);
controller.sync();
const input = document.querySelector('#answerInput');
const form = document.querySelector('#answerForm');
const primary = form.querySelector('button[type="submit"]');
const dontKnow = document.querySelector('#dontKnowBtn');
const feedback = document.querySelector('#answerFeedback');
const title = document.querySelector('#feedbackTitle');
const detail = document.querySelector('#feedbackDetail');
const correctAnswer = document.querySelector('#correctAnswer');

assert.equal(document.querySelector('#vocora-review-session-ux-style')?.getAttribute('href'), 'review-session-ux.css');
assert.ok(document.body.classList.contains('vocora-session-active'));
assert.ok(document.documentElement.classList.contains('vocora-session-active'));
assert.equal(document.querySelector('#sessionAccuracy').parentElement.id, 'vocoraSessionAccuracy');
assert.equal(input.getAttribute('aria-label'), 'پاسخ');
assert.ok(primary.classList.contains('is-empty'));
assert.ok(!primary.disabled, 'Empty primary remains clickable for the double-tap gesture.');
assert.ok(document.querySelector('#vocoraDoubleTapHint'));

let skips = 0;
dontKnow.addEventListener('click', () => { skips += 1; });
const tap1 = new window.MouseEvent('click', { bubbles:true, cancelable:true });
primary.dispatchEvent(tap1);
assert.equal(tap1.defaultPrevented, true);
assert.equal(skips, 0);
assert.ok(primary.classList.contains('skip-armed'));
const tap2 = new window.MouseEvent('click', { bubbles:true, cancelable:true });
primary.dispatchEvent(tap2);
assert.equal(skips, 1, 'Second quick empty tap reuses the existing dontKnow action.');
feedback.classList.remove('hidden'); feedback.classList.add('wrong'); controller.sync();
assert.ok(document.body.classList.contains('vocora-review-warning'));
assert.equal(title.textContent, 'اشکالی ندارد');
assert.equal(document.querySelector('#feedbackIcon').textContent, '!');
assert.equal(correctAnswer.textContent, "haven't");
assert.equal(input.readOnly, true);

feedback.classList.add('hidden'); feedback.classList.remove('wrong'); controller.sync();
input.value = 'havnt'; input.dispatchEvent(new window.Event('input', { bubbles:true }));
assert.ok(!primary.classList.contains('is-empty'));
feedback.classList.remove('hidden'); feedback.classList.add('wrong'); title.textContent='legacy'; detail.textContent='legacy'; correctAnswer.textContent=''; controller.sync();
assert.ok(document.body.classList.contains('vocora-review-wrong'));
assert.ok(input.classList.contains('vocora-answer-wrong'));
assert.equal(title.textContent, 'اشتباه بود');
assert.equal(detail.textContent, 'پاسخ درست را یک بار با دقت ببین.');
assert.equal(correctAnswer.textContent, "haven't");
assert.equal(document.querySelector('#nextCardBtn').textContent, 'ادامه');

feedback.classList.add('hidden'); feedback.classList.remove('wrong'); controller.sync();
input.value = "haven't"; input.dispatchEvent(new window.Event('input', { bubbles:true }));
feedback.classList.remove('hidden'); title.textContent='درست بود!'; detail.textContent='از خانهٔ ۱ به خانهٔ ۲ رفت.'; controller.sync();
assert.ok(document.body.classList.contains('vocora-review-correct'));
assert.ok(input.classList.contains('vocora-answer-correct'));
assert.equal(title.textContent, 'عالیه!');
assert.equal(detail.textContent, 'از خانهٔ ۱ به خانهٔ ۲ رفت.', 'Useful Leitner feedback is preserved.');

feedback.classList.add('hidden'); controller.sync(); input.value='havnt'; feedback.classList.remove('hidden'); feedback.classList.add('wrong'); correctAnswer.textContent='';
const remediation = document.querySelector('#practiceRemediation');
remediation.classList.remove('hidden'); document.querySelector('#flashCard').classList.add('remediation-active');
document.dispatchEvent(new window.CustomEvent('vocora:spelling-remediation-started', { detail:{ wordId:'word-1', mode:'box1', context:'immediate' } }));
controller.sync();
assert.equal(controller.getState().delayedRemediation, true);
assert.ok(!document.querySelector('#flashCard').classList.contains('remediation-active'));
const previewContinue = document.querySelector('#vocoraRemediationPreviewContinue');
assert.ok(previewContinue && !previewContinue.classList.contains('hidden'));
assert.equal(correctAnswer.textContent, "haven't");
previewContinue.click();
assert.equal(controller.getState().delayedRemediation, false);
assert.ok(document.querySelector('#flashCard').classList.contains('remediation-active'));

remediation.classList.add('hidden'); document.querySelector('#flashCard').classList.remove('remediation-active'); feedback.classList.add('hidden'); controller.sync();
input.focus(); controller.syncVisualViewport(); assert.ok(document.body.classList.contains('vocora-keyboard-open'));
input.blur(); visualViewport.height=520; controller.syncVisualViewport(); assert.ok(document.body.classList.contains('vocora-keyboard-open'));
visualViewport.height=800; controller.syncVisualViewport(); assert.ok(!document.body.classList.contains('vocora-keyboard-open'));

const reviewView = document.querySelector('#view-review');
reviewView.classList.remove('active'); controller.sync();
assert.ok(!document.body.classList.contains('vocora-session-active'), 'Navigating away releases the fixed shell even when session markup remains mounted.');
reviewView.classList.add('active'); controller.sync(); assert.ok(document.body.classList.contains('vocora-session-active'));
document.querySelector('#reviewSession').classList.add('hidden'); controller.sync();
assert.ok(!document.body.classList.contains('vocora-session-active'));
assert.ok(!document.documentElement.classList.contains('vocora-session-active'));

assert.match(cssSource, /body\.vocora-session-active \.sidebar[\s\S]*display:\s*none\s*!important/);
assert.match(cssSource, /body\.vocora-session-active[\s\S]*position:\s*fixed/);
assert.match(cssSource, /#answerForm \.answer-label[\s\S]*clip-path:\s*inset\(50%\)/);
assert.match(cssSource, /#dontKnowBtn[\s\S]*display:\s*none\s*!important/);
assert.match(cssSource, /vocora-keyboard-open[\s\S]*#answerForm/);
assert.match(cssSource, /vocora-review-wrong[\s\S]*#answerFeedback/);
assert.match(cssSource, /vocora-review-correct[\s\S]*#answerFeedback/);
assert.match(cssSource, /vocora-review-warning[\s\S]*#answerFeedback/);
console.log('Review session UX tests passed.');
