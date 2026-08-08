import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const domainSource = fs.readFileSync(new URL('../practice-remediation.js', import.meta.url), 'utf8');
const routerSource = fs.readFileSync(new URL('../practice-session-keyboard-router.js', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const controllerSource = fs.readFileSync(new URL('../practice-remediation-adapter.js', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fixture() {
  return `<!doctype html><html lang="fa" dir="rtl"><head></head><body>
    <div class="app-shell"><aside class="sidebar"></aside><main class="main-content"><header class="topbar"></header>
    <section class="view active" id="view-review">
      <button id="boxOnePracticeBtn" type="button">box1</button><button id="beginSessionBtn" type="button">scheduled</button><button id="practiceExtraBtn" type="button">extra</button>
      <form id="newWordsForm"><button type="submit">new</button></form>
      <div id="reviewSession" class="hidden">
        <div class="session-bar"><button id="exitSessionBtn" type="button">×</button><div class="session-progress"><div class="row-between"><span id="sessionCounter">تمرین آزاد · ۰ پاسخ</span><span id="sessionAccuracy">دقت: —</span></div><div class="progress-track"><i></i></div></div></div>
        <article id="flashCard"><div class="card-meta"><span id="cardCategory"></span><span id="cardBox"></span></div><p id="cardInstruction">تمرین آزاد خانهٔ ۱؛ این پاسخ جای کارت را تغییر نمی‌دهد.</p><button id="listenWordBtn" type="button"><span>▶</span><small>پخش تلفظ</small></button><button id="slowListenBtn" type="button">پخش آهسته‌تر</button>
          <form id="answerForm"><label class="answer-label" for="answerInput">پاسخ شما</label><input id="answerInput"><button type="submit">بررسی پاسخ</button></form><button id="dontKnowBtn" type="button">نمی‌دانم</button>
          <div id="answerFeedback" class="hidden"><div class="feedback-heading"><span id="feedbackIcon"></span><div><strong id="feedbackTitle"></strong><p id="feedbackDetail"></p></div></div><div class="correct-spelling"><small>املای صحیح</small><strong id="correctAnswer"></strong></div><p id="wordNote"></p><button id="nextCardBtn" type="button">ادامه</button></div>
        </article>
      </div><div id="sessionComplete" class="hidden"></div>
    </section></main></div>
  </body></html>`;
}

const WORDS = [
  { id: 'w1', term: 'accommodation', accepted: ['accommodation'], category: 'Study', box: 1, notes: '' },
  { id: 'w2', term: 'attendance', accepted: ['attendance'], category: 'Study', box: 1, notes: '' },
  { id: 'w3', term: 'specialist', accepted: ['specialist'], category: 'Jobs', box: 1, notes: '' },
  { id: 'w4', term: 'imaginative', accepted: ['imaginative'], category: 'Families', box: 1, notes: '' },
  { id: 'w5', term: 'dissertation', accepted: ['dissertation'], category: 'Study', box: 1, notes: '' },
  { id: 'w6', term: 'philosophy', accepted: ['philosophy'], category: 'Study', box: 1, notes: '' }
];

async function createHarness({ mode = 'box1', finiteTotal = 20 } = {}) {
  const dom = new JSDOM(fixture(), { url: 'https://vocora.test/#review', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  window.scrollTo = () => {};
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 800, offsetTop: 0, addEventListener() {} } });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const spoken = [];
  window.speechSynthesis = { cancel() {}, speak(utterance) { spoken.push(utterance.text); }, getVoices() { return []; } };

  let index = 0;
  let answered = 0;
  let nextCards = 0;
  let completed = false;
  let currentMode = mode;
  const word = () => WORDS[index % WORDS.length];
  window.VazheyarTest = { getCurrentWord: () => word(), getState: () => ({ settings: { voiceRate: 0.85 } }), isCorrectAnswer: (answer, candidate = word()) => candidate.accepted.some((value) => value === String(answer || '').trim()) };
  window.VazheyarReady = Promise.resolve();

  function renderCard() {
    document.querySelector('#cardCategory').textContent = word().category;
    document.querySelector('#cardBox').textContent = 'خانهٔ ۱';
    document.querySelector('#answerInput').value = '';
    document.querySelector('#answerForm').classList.remove('hidden');
    document.querySelector('#dontKnowBtn').classList.remove('hidden');
    document.querySelector('#answerFeedback').classList.add('hidden');
    document.querySelector('#answerFeedback').classList.remove('wrong');
    document.querySelector('#sessionCounter').textContent = currentMode === 'new' ? `کارت ${Math.min(answered + 1, finiteTotal)} از ${finiteTotal}` : `تمرین آزاد · ${answered} پاسخ`;
  }
  function start(selectedMode) {
    currentMode = selectedMode;
    document.querySelector('#cardInstruction').textContent = selectedMode === 'new' ? 'آزمون اولیه؛ پاسخ درست کارت را مستقیم به خانهٔ ۲ می‌برد.' : selectedMode === 'scheduled' ? 'کلمه را بشنو و املای آن را بنویس.' : 'تمرین آزاد خانهٔ ۱؛ این پاسخ جای کارت را تغییر نمی‌دهد.';
    document.querySelector('#reviewSession').classList.remove('hidden');
    renderCard();
  }

  document.querySelector('#boxOnePracticeBtn').addEventListener('click', () => start('box1'));
  document.querySelector('#beginSessionBtn').addEventListener('click', () => start('scheduled'));
  document.querySelector('#practiceExtraBtn').addEventListener('click', () => start('box1'));
  document.querySelector('#newWordsForm').addEventListener('submit', (event) => { event.preventDefault(); start('new'); });
  document.querySelector('#answerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = document.querySelector('#answerInput').value;
    const correct = window.VazheyarTest.isCorrectAnswer(answer, word());
    answered += 1;
    document.querySelector('#answerForm').classList.add('hidden'); document.querySelector('#dontKnowBtn').classList.add('hidden'); document.querySelector('#answerFeedback').classList.remove('hidden'); document.querySelector('#answerFeedback').classList.toggle('wrong', !correct);
    document.querySelector('#feedbackTitle').textContent = correct ? 'درست بود!' : 'اشتباه بود'; document.querySelector('#feedbackDetail').textContent = correct ? 'ثبت شد.' : 'اشتباه بود.'; document.querySelector('#correctAnswer').textContent = word().accepted.join(' / ');
  });
  document.querySelector('#dontKnowBtn').addEventListener('click', () => { document.querySelector('#answerInput').value = ''; document.querySelector('#answerForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  document.querySelector('#nextCardBtn').addEventListener('click', () => {
    nextCards += 1;
    if (currentMode === 'new' && answered >= finiteTotal) { completed = true; document.querySelector('#reviewSession').classList.add('hidden'); document.querySelector('#sessionComplete').classList.remove('hidden'); return; }
    index += 1; renderCard();
  });
  document.querySelector('#exitSessionBtn').addEventListener('click', () => document.querySelector('#reviewSession').classList.add('hidden'));

  window.eval(routerSource); window.eval(domainSource); window.eval(viewSource); window.eval(controllerSource);
  const controller = await window.VocoraPracticeRemediationReady;
  assert.ok(controller);
  if (mode === 'new') document.querySelector('#newWordsForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  else document.querySelector(mode === 'scheduled' ? '#beginSessionBtn' : '#boxOnePracticeBtn').click();
  await tick();
  return { dom, window, document, controller, spoken, metrics: () => ({ index, answered, nextCards, completed }) };
}

function visible(element) { return !element.classList.contains('hidden'); }
function assertExclusive(harness, label) {
  const stages = [harness.document.querySelector('#answerForm'), harness.document.querySelector('#answerFeedback'), harness.document.querySelector('#practiceRemediation')];
  const visibleStages = stages.filter(visible);
  assert.equal(visibleStages.length, 1, `${label}: exactly one stage must be visible`);
  assert.equal(harness.controller.snapshot().stage, harness.document.querySelector('#reviewSession').dataset.vocoraStage, `${label}: DOM and workflow stage match`);
  if (visibleStages[0].id === 'practiceRemediation') assert.equal(visibleStages[0].hasAttribute('inert'), false, `${label}: remediation is interactive`);
}
function submit(harness, value) { harness.document.querySelector('#answerInput').value = value; harness.document.querySelector('#answerForm').dispatchEvent(new harness.window.Event('submit', { bubbles: true, cancelable: true })); }
function enter(harness, target = harness.document.body) { const event = new harness.window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }); target.dispatchEvent(event); return event; }

{
  const h = await createHarness(); submit(h, 'accommodation'); await tick();
  assert.equal(h.controller.snapshot().stage, 'feedback-correct'); assert.equal(h.document.querySelector('#correctAnswer').textContent, 'accommodation'); assertExclusive(h, 'correct feedback');
  enter(h); await tick(); assert.equal(h.metrics().nextCards, 1); assert.equal(h.controller.snapshot().stage, 'answer'); assertExclusive(h, 'after correct Enter'); h.dom.window.close();
}

{
  const h = await createHarness(); submit(h, 'acommodation'); await tick();
  assert.equal(h.controller.snapshot().stage, 'feedback-wrong'); h.document.querySelector('#nextCardBtn').click(); assert.equal(h.controller.snapshot().stage, 'remediation-correction'); assertExclusive(h, 'correction');
  enter(h); assert.equal(h.controller.snapshot().stage, 'remediation-recall'); const input = h.document.querySelector('#remediationInput');
  input.value = 'acommodation'; enter(h, input); assert.equal(h.controller.snapshot().stage, 'remediation-copy'); input.value = 'accomodation'; enter(h, input); assert.equal(h.controller.snapshot().stage, 'remediation-copy');
  input.value = 'accommodation'; enter(h, input); assert.equal(h.controller.snapshot().stage, 'remediation-recall'); input.value = 'accommodation'; enter(h, input); assert.equal(h.controller.snapshot().stage, 'remediation-completed');
  enter(h); await tick(); assert.equal(h.metrics().nextCards, 1); assertExclusive(h, 'after remediation'); h.dom.window.close();
}

{
  const h = await createHarness(); submit(h, 'acommodation'); await tick(); enter(h); enter(h); let input = h.document.querySelector('#remediationInput'); input.value = 'accommodation'; enter(h, input); enter(h); await tick();
  for (const spelling of ['attendance', 'specialist', 'imaginative']) { submit(h, spelling); await tick(); assert.equal(h.document.querySelector('#correctAnswer').textContent, spelling); enter(h); await tick(); assertExclusive(h, `primary ${spelling}`); }
  assert.equal(h.controller.snapshot().stage, 'remediation-recall'); assert.equal(h.document.querySelector('#answerFeedback').classList.contains('hidden'), true); assert.equal(h.document.querySelector('#correctAnswer').textContent, 'imaginative');
  input = h.document.querySelector('#remediationInput'); input.value = 'accommodation'; enter(h, input); assert.equal(h.controller.snapshot().stage, 'remediation-completed'); h.document.querySelector('#remediationContinueBtn').click(); await tick();
  assert.equal(h.controller.snapshot().stage, 'answer'); assertExclusive(h, 'after due recheck'); h.dom.window.close();
}

{
  const h = await createHarness(); const workflow = h.controller.workflow;
  workflow.scheduleRecheck({ word: WORDS[0], mode: 'box1', recheckNumber: 1 }, 0); workflow.scheduleRecheck({ word: WORDS[1], mode: 'box1', recheckNumber: 1 }, 0);
  submit(h, 'accommodation'); await tick(); const before = h.metrics().nextCards; enter(h); assert.equal(h.controller.snapshot().active.wordId, 'w1'); let input = h.document.querySelector('#remediationInput');
  input.value = 'wrong'; enter(h, input); input.value = 'accommodation'; enter(h, input); input.value = 'accommodation'; enter(h, input); enter(h); assert.equal(h.controller.snapshot().active.wordId, 'w2');
  input = h.document.querySelector('#remediationInput'); input.value = 'attendance'; enter(h, input); enter(h); await tick(); assert.equal(h.metrics().nextCards, before + 1); assertExclusive(h, 'multiple rechecks'); h.dom.window.close();
}

{
  const h = await createHarness({ mode: 'new', finiteTotal: 1 }); h.controller.workflow.scheduleRecheck({ word: WORDS[1], mode: 'new', recheckNumber: 1 }, 4); submit(h, 'accommodation'); await tick(); enter(h);
  assert.equal(h.controller.snapshot().stage, 'remediation-recall'); const input = h.document.querySelector('#remediationInput'); input.value = 'attendance'; enter(h, input); enter(h); await tick(); assert.equal(h.metrics().completed, true); h.dom.window.close();
}

{
  const h = await createHarness();
  for (let step = 0; step < 45; step += 1) {
    const current = WORDS[h.metrics().index % WORDS.length]; const wrong = step % 6 === 0; submit(h, wrong ? `${current.term}x` : current.term); await tick(); assertExclusive(h, `long run ${step} feedback`);
    let guard = 0;
    while (h.controller.snapshot().stage !== 'answer' && guard++ < 20) {
      const stage = h.controller.snapshot().stage;
      if (stage.startsWith('feedback-') || stage === 'remediation-correction' || stage === 'remediation-completed') enter(h);
      else { const active = h.controller.snapshot().active; const input = h.document.querySelector('#remediationInput'); input.value = active.spelling; enter(h, input); }
      await tick(); assertExclusive(h, `long run ${step} transition ${guard}`);
    }
    assert.ok(guard < 20, `long run ${step} must converge to the next answer card`);
  }
  h.dom.window.close();
}

console.log('Practice session controller scenario tests passed.');
