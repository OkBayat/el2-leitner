import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const guardSource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');
const indexMarkup = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptOrder = [...indexMarkup.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((match) => match[1].split('?')[0]);

assert.ok(
  scriptOrder.indexOf('practice-remediation-keyboard-guard.js') < scriptOrder.indexOf('app-v2.js'),
  'The stage-aware keyboard router must register before the legacy app shortcut.'
);
assert.match(guardSource, /addEventListener\('keydown', handler, true\)/,
  'The router must own Enter in capture phase before adapter/app document listeners.');
assert.match(guardSource, /review-session-ux\.js\?v=\$\{Date\.now\(\)\}/,
  'The dynamically loaded review coordinator must use a unique URL on every page load.');
assert.doesNotMatch(guardSource, /vocoraRemediationPreviewContinue/,
  'Enter routing must reuse real visible controls, not a duplicated CTA.');

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="reviewSession" data-vocora-stage="answer">
    <form id="answerForm"><input id="answerInput"><button id="answerSubmit" type="submit">answer</button></form>
    <div id="answerFeedback" class="hidden">
      <button id="nextCardBtn" type="button">continue</button>
    </div>
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
const remediationSubmit = document.querySelector('#remediationSubmitBtn');
const acknowledge = document.querySelector('#remediationAcknowledgeBtn');
const remediationContinue = document.querySelector('#remediationContinueBtn');
const listen = document.querySelector('#remediationListenBtn');
const ordinary = document.querySelector('#ordinaryControl');

let snapshotActive = null;
window.VocoraPracticeRemediation = {
  snapshot: () => ({ active: snapshotActive })
};

const metrics = {
  feedbackContinues: 0,
  acknowledgements: 0,
  remediationContinues: 0,
  remediationSubmits: 0,
  listens: 0,
  answerSubmits: 0,
  legacyNextCards: 0
};

feedbackContinue.addEventListener('click', () => { metrics.feedbackContinues += 1; });
acknowledge.addEventListener('click', () => { metrics.acknowledgements += 1; });
remediationContinue.addEventListener('click', () => { metrics.remediationContinues += 1; });
listen.addEventListener('click', () => { metrics.listens += 1; });
remediationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  metrics.remediationSubmits += 1;
});
answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  metrics.answerSubmits += 1;
});

window.eval(guardSource);
const guard = window.VocoraRemediationKeyboardGuard;
assert.equal(guard.install(document, window), false, 'Installation must be idempotent.');
assert.equal(guard.loadReviewSessionUx(document), false, 'Dynamic loader must be idempotent.');
assert.match(
  document.querySelector('#vocora-review-session-ux-script')?.getAttribute('src') || '',
  /^review-session-ux\.js\?v=\d+$/
);

// Models app-v2's old document shortcut. The guard must stop this listener when
// feedback/remediation owns Enter, while leaving ordinary answer submission alone.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!feedback.classList.contains('hidden') || !remediation.classList.contains('hidden')) {
    event.preventDefault();
    metrics.legacyNextCards += 1;
  }
});

function resetVisibility() {
  session.dataset.vocoraStage = 'answer';
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

function showFeedback({ deferred = false } = {}) {
  resetVisibility();
  session.dataset.vocoraStage = 'feedback-wrong';
  answerForm.classList.add('hidden');
  feedback.classList.remove('hidden');
  snapshotActive = deferred
    ? { wordId: 'word-1', phase: 'correction', context: 'immediate', presentationDeferred: true }
    : null;
}

function showCorrection() {
  resetVisibility();
  session.dataset.vocoraStage = 'remediation-correction';
  answerForm.classList.add('hidden');
  remediation.classList.remove('hidden');
  acknowledge.classList.remove('hidden');
  snapshotActive = { wordId: 'word-1', phase: 'correction', context: 'immediate', presentationDeferred: false };
}

function showRecall() {
  resetVisibility();
  session.dataset.vocoraStage = 'remediation-recall';
  answerForm.classList.add('hidden');
  remediation.classList.remove('hidden');
  remediationForm.classList.remove('hidden');
  snapshotActive = { wordId: 'word-1', phase: 'recall', context: 'immediate', presentationDeferred: false };
}

function showCompleted() {
  resetVisibility();
  session.dataset.vocoraStage = 'remediation-completed';
  answerForm.classList.add('hidden');
  remediation.classList.remove('hidden');
  listen.classList.add('hidden');
  remediationContinue.classList.remove('hidden');
  snapshotActive = { wordId: 'word-1', phase: 'completed', context: 'immediate', presentationDeferred: false };
}

function pressEnter(element, options = {}) {
  const event = new window.KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...options
  });
  element.dispatchEvent(event);
  return event;
}

// Ordinary answer input is intentionally outside this router; native form Enter
// remains available and no practice-stage action is synthesized.
resetVisibility();
let event = pressEnter(answerInput);
assert.equal(event.defaultPrevented, false);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(metrics.feedbackContinues, 0);

// Feedback: Enter anywhere invokes the exact same Continue click once, whether
// remediation is deferred or this is an ordinary correct-result page.
showFeedback({ deferred: true });
event = pressEnter(ordinary);
assert.equal(metrics.feedbackContinues, 1);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

showFeedback({ deferred: false });
event = pressEnter(feedbackContinue);
assert.equal(metrics.feedbackContinues, 2, 'Focused feedback button must not double-fire.');
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

// Correction: focus can be on body/another control; Enter still activates the
// visible acknowledgement action. Focused buttons are manually clicked once too.
showCorrection();
event = pressEnter(ordinary);
assert.equal(metrics.acknowledgements, 1);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

showCorrection();
event = pressEnter(acknowledge);
assert.equal(metrics.acknowledgements, 2, 'Focused acknowledgement must fire exactly once.');
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

// A deliberately focused secondary button keeps its own semantics.
showCorrection();
event = pressEnter(listen);
assert.equal(metrics.listens, 1);
assert.equal(metrics.acknowledgements, 2);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

// Recall/copy input submits the real remediation form. If focus is elsewhere and
// the input is empty, Enter focuses the input instead of submitting an empty value.
showRecall();
remediationInput.value = 'accommodation';
event = pressEnter(remediationInput);
assert.equal(metrics.remediationSubmits, 1);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

showRecall();
event = pressEnter(ordinary);
assert.equal(document.activeElement, remediationInput);
assert.equal(metrics.remediationSubmits, 1);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

showRecall();
remediationInput.value = 'accommodation';
event = pressEnter(ordinary);
assert.equal(metrics.remediationSubmits, 2, 'A filled visible remediation form can be submitted globally.');
assert.equal(metrics.legacyNextCards, 0);

// Completed remediation uses the same Enter routing as its visible Continue click.
showCompleted();
event = pressEnter(ordinary);
assert.equal(metrics.remediationContinues, 1);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

// Holding Enter cannot advance multiple stages.
showCompleted();
event = pressEnter(ordinary, { repeat: true });
assert.equal(metrics.remediationContinues, 1);
assert.equal(metrics.legacyNextCards, 0);
assert.equal(event.defaultPrevented, true);

// IME completion is not submitted, but the legacy global shortcut is still blocked.
showRecall();
event = pressEnter(remediationInput, { isComposing: true, keyCode: 229 });
assert.equal(metrics.remediationSubmits, 2);
assert.equal(metrics.legacyNextCards, 0);

console.log('Remediation keyboard guard tests passed.');
