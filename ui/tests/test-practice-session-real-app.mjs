import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const rawHtml = fs.readFileSync(new URL('index.html', root), 'utf8');
const html = rawHtml.replace(/<script\s+src="[^"]+"><\/script>/g, '');
const sources = {
  vocabulary: fs.readFileSync(new URL('vocabulary.js', root), 'utf8'),
  share: fs.readFileSync(new URL('share-story-v2.js', root), 'utf8'),
  domain: fs.readFileSync(new URL('practice-remediation.js', root), 'utf8'),
  router: fs.readFileSync(new URL('practice-session-keyboard-router.js', root), 'utf8'),
  view: fs.readFileSync(new URL('review-session-ux.js', root), 'utf8'),
  app: fs.readFileSync(new URL('app-v2.js', root), 'utf8'),
  controller: fs.readFileSync(new URL('practice-remediation-adapter.js', root), 'utf8'),
  prompt: fs.readFileSync(new URL('practice-remediation-recheck-prompt.js', root), 'utf8')
};

function installCanvasMocks(window) {
  const context = {
    globalAlpha: 1,
    beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
    arc() {}, stroke() {}, fill() {}, save() {}, restore() {}, fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: String(text).length * 22 }; },
    fillText() {}
  };
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value() { return context; }
  });
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value(callback, type) { callback(new window.Blob(['png'], { type })); }
  });
  window.URL.createObjectURL = () => 'blob:vocora-story';
  window.URL.revokeObjectURL = () => {};
  Object.defineProperty(window.navigator, 'canShare', {
    configurable: true,
    value: () => false
  });
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { async writeText() {} }
  });
}

function response(status, payload = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === null ? '' : JSON.stringify(payload); }
  };
}

async function createAppHarness() {
  let serverState = null;
  let revision = 0;
  const spoken = [];
  const dom = new JSDOM(html, {
    url: 'https://vocora.test/#dashboard',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      installCanvasMocks(window);
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      window.scrollTo = () => {};
      window.confirm = () => true;
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: { height: 800, offsetTop: 0, addEventListener() {} }
      });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      window.speechSynthesis = {
        cancel() {},
        speak(utterance) { spoken.push(utterance.text); },
        getVoices() { return []; }
      };
      window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
      window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
      window.fetch = async (path, options = {}) => {
        const method = options.method || 'GET';
        if (path === '/api/auth/me' && method === 'GET') {
          return response(200, { user: { id: 1, email: 'workflow@example.com' } });
        }
        if (path === '/api/state' && method === 'GET') {
          return response(200, { state: serverState, revision });
        }
        if (path === '/api/state' && method === 'PUT') {
          const payload = JSON.parse(options.body);
          assert.equal(payload.revision, revision);
          serverState = JSON.parse(JSON.stringify(payload.state));
          revision += 1;
          return response(200, { state: serverState, revision });
        }
        if (path === '/api/auth/logout' && method === 'POST') return response(204);
        return response(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
      };
    }
  });

  const { window } = dom;
  window.Math.random = () => 0;
  window.VocoraPracticeRecheckPromptConfig = { delayMs: 0 };
  window.eval(sources.vocabulary);
  window.eval(sources.share);
  window.eval(sources.domain);
  window.eval(sources.router);
  window.eval(sources.view);
  window.eval(sources.app);
  window.eval(sources.controller);
  window.eval(sources.prompt);

  await window.VazheyarReady;
  const controller = await window.VocoraPracticeRemediationReady;
  const prompt = await window.VocoraPracticeRecheckPromptReady;
  await window.VazheyarTest.waitForSaves();
  assert.ok(controller);
  assert.ok(prompt);

  // The production home button intentionally waits 50ms before starting box-one
  // practice. A default 80ms settle therefore observes the real session boundary,
  // while callers can still request a shorter wait for synchronous transitions.
  const settle = async (milliseconds = 80) => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
    await Promise.resolve();
  };

  return {
    dom,
    window,
    document: window.document,
    controller,
    spoken,
    settle,
    state: async () => {
      await window.VazheyarTest.waitForSaves();
      return JSON.parse(JSON.stringify(serverState));
    }
  };
}

function visible(element) {
  return Boolean(element && !element.classList.contains('hidden'));
}

function assertExclusive(harness, label) {
  const elements = [
    harness.document.querySelector('#answerForm'),
    harness.document.querySelector('#answerFeedback'),
    harness.document.querySelector('#practiceRemediation')
  ];
  const visibleStages = elements.filter(visible);
  assert.equal(visibleStages.length, 1, `${label}: exactly one stage must be visible`);
  assert.equal(
    harness.document.querySelector('#reviewSession').dataset.vocoraStage,
    harness.controller.snapshot().stage,
    `${label}: workflow and DOM stages must match`
  );
  for (const element of elements) {
    const shouldBeVisible = element === visibleStages[0];
    assert.equal(element.hasAttribute('inert'), !shouldBeVisible, `${label}: inert ownership`);
    assert.equal(element.getAttribute('aria-hidden'), shouldBeVisible ? 'false' : 'true', `${label}: aria ownership`);
  }
}

function pressEnter(harness, target = harness.document.body) {
  const event = new harness.window.KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true
  });
  target.dispatchEvent(event);
  return event;
}

async function submitPrimary(harness, value) {
  const input = harness.document.querySelector('#answerInput');
  input.value = value;
  harness.document.querySelector('#answerForm').dispatchEvent(
    new harness.window.Event('submit', { bubbles: true, cancelable: true })
  );
  await harness.settle();
}

async function completeRecall(harness, spelling) {
  const input = harness.document.querySelector('#remediationInput');
  await harness.settle(5);
  assert.equal(input.disabled, false);
  input.value = spelling;
  const event = pressEnter(harness, input);
  assert.equal(event.defaultPrevented, true);
  await harness.settle();
}

// Real production stack: a wrong answer, three intervening cards, then a due recheck.
{
  const h = await createAppHarness();
  h.document.querySelector('#boxOnePracticeBtn').click();
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'answer');
  assertExclusive(h, 'box1 start');

  const original = h.window.VazheyarTest.getCurrentWord();
  await submitPrimary(h, `${original.term}x`);
  assert.equal(h.controller.snapshot().stage, 'feedback-wrong');
  assert.equal(h.document.querySelector('#correctAnswer').textContent, original.accepted.join(' / '));
  assertExclusive(h, 'wrong feedback');

  pressEnter(h);
  assert.equal(h.controller.snapshot().stage, 'remediation-correction');
  assertExclusive(h, 'immediate correction');
  pressEnter(h);
  assert.equal(h.controller.snapshot().stage, 'remediation-recall');
  await completeRecall(h, original.term);
  assert.equal(h.controller.snapshot().stage, 'remediation-completed');
  pressEnter(h);
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'answer');
  assertExclusive(h, 'after immediate remediation');

  let lastPrimaryId = null;
  for (let index = 0; index < 3; index += 1) {
    const word = h.window.VazheyarTest.getCurrentWord();
    lastPrimaryId = word.id;
    await submitPrimary(h, word.term);
    assert.equal(h.controller.snapshot().stage, 'feedback-correct');
    assert.equal(h.document.querySelector('#correctAnswer').textContent, word.accepted.join(' / '));
    assertExclusive(h, `correct feedback ${index + 1}`);
    pressEnter(h);
    await h.settle(5);
    if (index < 2) {
      assert.equal(h.controller.snapshot().stage, 'answer');
      assertExclusive(h, `after correct feedback ${index + 1}`);
    }
  }

  const due = h.controller.snapshot();
  assert.equal(due.stage, 'remediation-recall');
  assert.equal(due.active.context, 'recheck');
  assert.equal(due.active.wordId, original.id);
  assert.equal(h.window.VazheyarTest.getCurrentWord().id, lastPrimaryId, 'A due recheck must not consume the underlying primary card.');
  assert.equal(h.document.querySelector('#answerFeedback').classList.contains('hidden'), true);
  assert.equal(h.document.querySelector('#correctAnswer').textContent.length > 0, true, 'Primary feedback content must never be destructively erased.');
  assertExclusive(h, 'due recheck');

  await completeRecall(h, original.term);
  assert.equal(h.controller.snapshot().stage, 'remediation-completed');
  pressEnter(h);
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'answer');
  assert.notEqual(h.window.VazheyarTest.getCurrentWord().id, lastPrimaryId, 'Completing the due recheck must advance the primary session exactly once.');
  assertExclusive(h, 'after due recheck');
  h.dom.window.close();
}

// Failed recalls, copy retries, and a second recheck after one intervening card.
{
  const h = await createAppHarness();
  h.document.querySelector('#boxOnePracticeBtn').click();
  await h.settle();
  const original = h.window.VazheyarTest.getCurrentWord();
  await submitPrimary(h, `${original.term}x`);
  pressEnter(h);
  pressEnter(h);
  let input = h.document.querySelector('#remediationInput');
  input.value = `${original.term}x`;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-copy');
  input.value = `${original.term}y`;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-copy');
  input.value = original.term;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-recall');
  input.value = original.term;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-completed');
  pressEnter(h);
  await h.settle();

  for (let index = 0; index < 3; index += 1) {
    const word = h.window.VazheyarTest.getCurrentWord();
    await submitPrimary(h, word.term);
    pressEnter(h);
    await h.settle(5);
  }
  assert.equal(h.controller.snapshot().stage, 'remediation-recall');
  assert.equal(h.controller.snapshot().active.recheckNumber, 1);
  await h.settle(5);
  input = h.document.querySelector('#remediationInput');
  input.value = `${original.term}x`;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-copy');
  input.value = original.term;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-recall');
  input.value = original.term;
  pressEnter(h, input);
  assert.equal(h.controller.snapshot().stage, 'remediation-completed');
  assert.equal(h.controller.snapshot().queue[0].remainingCards, 1);
  pressEnter(h);
  await h.settle();

  const intervening = h.window.VazheyarTest.getCurrentWord();
  await submitPrimary(h, intervening.term);
  pressEnter(h);
  await h.settle(5);
  assert.equal(h.controller.snapshot().stage, 'remediation-recall');
  assert.equal(h.controller.snapshot().active.recheckNumber, 2);
  await completeRecall(h, original.term);
  pressEnter(h);
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'answer');
  assertExclusive(h, 'after second recheck');
  h.dom.window.close();
}

// Double activation of the empty primary action reuses the real unknown business action once.
{
  const h = await createAppHarness();
  h.document.querySelector('#boxOnePracticeBtn').click();
  await h.settle();
  const historyBefore = (await h.state()).history.length;
  const primary = h.document.querySelector('#answerForm button[type="submit"]');
  primary.click();
  primary.click();
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'feedback-warning');
  assert.equal((await h.state()).history.length, historyBefore + 1);
  assert.equal(h.document.querySelector('#correctAnswer').textContent.length > 0, true);
  assertExclusive(h, 'unknown feedback');
  h.document.querySelector('#exitSessionBtn').click();
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'idle');
  h.dom.window.close();
}

// Scheduled review retains its original rule: wrong answers repeat later but do not open remediation.
{
  const h = await createAppHarness();
  h.document.querySelector('#beginSessionBtn').click();
  await h.settle();
  const word = h.window.VazheyarTest.getCurrentWord();
  await submitPrimary(h, `${word.term}x`);
  const snapshot = h.controller.snapshot();
  assert.equal(snapshot.stage, 'feedback-wrong');
  assert.equal(snapshot.active, null);
  assertExclusive(h, 'scheduled wrong feedback');
  pressEnter(h);
  await h.settle();
  assert.equal(h.controller.snapshot().stage, 'answer');
  assertExclusive(h, 'scheduled next card');
  h.dom.window.close();
}

// The last card of a finite new-word session flushes one queued recheck before completion.
{
  const h = await createAppHarness();
  h.document.querySelector('#addNewWordsBtn').click();
  h.document.querySelector('#newWordsCountInput').value = '1';
  h.document.querySelector('#newWordsForm').dispatchEvent(
    new h.window.Event('submit', { bubbles: true, cancelable: true })
  );
  await h.settle();
  const word = h.window.VazheyarTest.getCurrentWord();
  h.controller.workflow.scheduleRecheck({
    word: { ...word, accepted: [...word.accepted] },
    mode: 'new',
    recheckNumber: 1,
    originId: null
  }, 4);
  await submitPrimary(h, word.term);
  pressEnter(h);
  await h.settle(5);
  assert.equal(h.controller.snapshot().stage, 'remediation-recall');
  await completeRecall(h, word.term);
  pressEnter(h);
  await h.settle();
  assert.equal(h.document.querySelector('#sessionComplete').classList.contains('hidden'), false);
  assert.equal(h.controller.snapshot().stage, 'idle');
  h.dom.window.close();
}

console.log('Real-app practice session workflow tests passed.');
