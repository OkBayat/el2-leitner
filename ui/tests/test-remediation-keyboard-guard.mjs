import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const routerSource = fs.readFileSync(new URL('../practice-session-keyboard-router.js', import.meta.url), 'utf8');
const compatibilitySource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');
const indexMarkup = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptOrder = [...indexMarkup.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((match) => match[1].split('?')[0]);

assert.ok(
  scriptOrder.indexOf('practice-session-keyboard-router.js') < scriptOrder.indexOf('app-v2.js'),
  'The new keyboard router must load before app-v2.'
);
assert.ok(
  scriptOrder.indexOf('practice-session-keyboard-router.js') < scriptOrder.indexOf('practice-remediation-adapter.js'),
  'The router must load before the remediation adapter.'
);
assert.equal(
  scriptOrder.includes('practice-remediation-keyboard-guard.js'),
  false,
  'New HTML must not execute the legacy document-level guard.'
);
assert.match(routerSource, /windowObject\.addEventListener\('keydown', handler, true\)/,
  'The router must own Enter at window capture, before every document listener.');
assert.match(routerSource, /submitRemediationAnswer/);
assert.match(routerSource, /revealDeferredPresentation/);
assert.match(routerSource, /continueSession/);
assert.match(compatibilitySource, /practice-session-keyboard-router\.js\?v=/,
  'Old cached HTML must be upgraded by the compatibility bootstrap.');

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="reviewSession">
    <form id="answerForm"><input id="answerInput"><button type="submit">answer</button></form>
    <div id="answerFeedback" class="hidden"><button id="nextCardBtn" type="button">continue</button></div>
    <section id="practiceRemediation" class="hidden">
      <button id="remediationListenBtn" type="button">listen</button>
      <form id="remediationForm" class="hidden">
        <input id="remediationInput">
        <button id="remediationSubmitBtn" type="submit">submit</button>
      </form>
      <button id="remediationAcknowledgeBtn" class="hidden" type="button">acknowledge</button>
      <button id="remediationContinueBtn" class="hidden" type="button">continue remediation</button>
    </section>
  </div>
  <button id="ordinaryControl" type="button">ordinary</button>
</body></html>`, {
  url: 'https://vocora.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;
const session = document.querySelector('#reviewSession');
const answerForm = document.querySelector('#answerForm');
const answerInput = document.querySelector('#answerInput');
const feedback = document.querySelector('#answerFeedback');
const feedbackContinue = document.querySelector('#nextCardBtn');
const remediation = document.querySelector('#practiceRemediation');
const remediationForm = document.querySelector('#remediationForm');
const remediationInput = document.querySelector('#remediationInput');
const acknowledge = document.querySelector('#remediationAcknowledgeBtn');
const remediationContinue = document.querySelector('#remediationContinueBtn');
const listen = document.querySelector('#remediationListenBtn');
const ordinary = document.querySelector('#ordinaryControl');

let snapshotActive = null;
const metrics = {
  reveal: 0,
  acknowledge: 0,
  submit: 0,
  continue: 0,
  feedbackClick: 0,
  listen: 0,
  adapterDocumentKeydown: 0,
  appDocumentKeydown: 0
};

window.VocoraPracticeRemediation = {
  snapshot: () => ({ active: snapshotActive }),
  revealDeferredPresentation() {
    metrics.reveal += 1;
    snapshotActive = { ...snapshotActive, presentationDeferred: false };
    feedback.classList.add('hidden');
    remediation.classList.remove('hidden');
    acknowledge.classList.remove('hidden');
    return true;
  },
  acknowledge() {
    metrics.acknowledge += 1;
    snapshotActive = { ...snapshotActive, phase: 'recall' };
    acknowledge.classList.add('hidden');
    remediationForm.classList.remove('hidden');
  },
  submitRemediationAnswer(value) {
    metrics.submit += 1;
    assert.equal(value, 'accommodation');
    snapshotActive = { ...snapshotActive, phase: 'completed' };
    remediationForm.classList.add('hidden');
    remediationContinue.classList.remove('hidden');
  },
  continueSession() {
    metrics.continue += 1;
    snapshotActive = null;
    remediation.classList.add('hidden');
  }
};

feedbackContinue.addEventListener('click', () => { metrics.feedbackClick += 1; });
listen.addEventListener('click', () => { metrics.listen += 1; });

window.eval(routerSource);
const router = window.VocoraPracticeKeyboardRouter;
assert.ok(router);
assert.equal(router.install(window, document), false, 'Router installation must be idempotent.');
assert.equal(router.RELEASE, '20260808-enter-router2');

// These model the two listeners that previously swallowed/misrouted Enter.
document.addEventListener('keydown', () => { metrics.adapterDocumentKeydown += 1; }, true);
document.addEventListener('keydown', () => { metrics.appDocumentKeydown += 1; });

function reset() {
  session.classList.remove('hidden');
  answerForm.classList.remove('hidden');
  feedback.classList.add('hidden');
  remediation.classList.add('hidden');
  remediationForm.classList.add('hidden');
  acknowledge.classList.add('hidden');
  remediationContinue.classList.add('hidden');
  listen.classList.remove('hidden');
  remediationInput.value = '';
  snapshotActive = null;
}

function pressEnter(element, options = {}) {
  const event = new window.KeyboardEvent('keydown', {
    key: 'Enter',
    code: options.code || 'Enter',
    bubbles: true,
    cancelable: true,
    repeat: Boolean(options.repeat),
    isComposing: Boolean(options.isComposing)
  });
  if (options.keyCode) Object.defineProperty(event, 'keyCode', { value: options.keyCode });
  element.dispatchEvent(event);
  return event;
}

// Normal answer typing stays native and reaches document listeners.
reset();
let event = pressEnter(answerInput);
assert.equal(event.defaultPrevented, false);
assert.equal(metrics.adapterDocumentKeydown, 1);
assert.equal(metrics.appDocumentKeydown, 1);

// Ordinary feedback uses its real Continue click.
reset();
answerForm.classList.add('hidden');
feedback.classList.remove('hidden');
event = pressEnter(ordinary);
assert.equal(metrics.feedbackClick, 1);
assert.equal(event.defaultPrevented, true);
assert.equal(metrics.adapterDocumentKeydown, 1, 'Window capture must stop adapter capture.');
assert.equal(metrics.appDocumentKeydown, 1, 'Window capture must stop app-v2 bubble shortcut.');

// Deferred wrong feedback calls the remediation controller directly.
reset();
answerForm.classList.add('hidden');
feedback.classList.remove('hidden');
snapshotActive = {
  wordId: 'word-1', phase: 'correction', context: 'immediate', presentationDeferred: true
};
event = pressEnter(feedbackContinue);
assert.equal(metrics.reveal, 1);
assert.equal(snapshotActive.presentationDeferred, false);
assert.equal(event.defaultPrevented, true);
assert.equal(metrics.adapterDocumentKeydown, 1);
assert.equal(metrics.appDocumentKeydown, 1);

// Correction works regardless of where focus remained after the prior screen.
event = pressEnter(ordinary);
assert.equal(metrics.acknowledge, 1);
assert.equal(snapshotActive.phase, 'recall');
assert.equal(metrics.adapterDocumentKeydown, 1);
assert.equal(metrics.appDocumentKeydown, 1);

// Empty recall focuses the real input; filled recall submits through the controller.
event = pressEnter(ordinary);
assert.equal(document.activeElement, remediationInput);
assert.equal(metrics.submit, 0);
remediationInput.value = 'accommodation';
event = pressEnter(remediationInput);
assert.equal(metrics.submit, 1);
assert.equal(snapshotActive.phase, 'completed');

// Completed remediation advances through the controller.
event = pressEnter(ordinary);
assert.equal(metrics.continue, 1);
assert.equal(snapshotActive, null);

// A deliberately focused pronunciation button keeps its own semantics.
reset();
answerForm.classList.add('hidden');
remediation.classList.remove('hidden');
acknowledge.classList.remove('hidden');
snapshotActive = {
  wordId: 'word-2', phase: 'correction', context: 'immediate', presentationDeferred: false
};
event = pressEnter(listen);
assert.equal(metrics.listen, 1);
assert.equal(metrics.acknowledge, 1);

// Numpad Enter follows the same route.
event = pressEnter(ordinary, { code: 'NumpadEnter' });
assert.equal(metrics.acknowledge, 2);

// Held Enter and IME completion cannot run a second action.
reset();
answerForm.classList.add('hidden');
remediation.classList.remove('hidden');
remediationContinue.classList.remove('hidden');
snapshotActive = {
  wordId: 'word-3', phase: 'completed', context: 'immediate', presentationDeferred: false
};
event = pressEnter(ordinary, { repeat: true });
assert.equal(metrics.continue, 1);
assert.equal(event.defaultPrevented, true);

event = pressEnter(ordinary, { isComposing: true, keyCode: 229 });
assert.equal(metrics.continue, 1);

console.log('Practice session keyboard router tests passed.');
