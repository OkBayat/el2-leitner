import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const guardSource = fs.readFileSync(new URL('../practice-remediation-keyboard-guard.js', import.meta.url), 'utf8');
const indexMarkup = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptOrder = [...indexMarkup.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);

assert.ok(
  scriptOrder.indexOf('practice-remediation-keyboard-guard.js') < scriptOrder.indexOf('app-v2.js'),
  'The remediation keyboard guard must register before the legacy app shortcut listener.'
);

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="answerFeedback"><button id="nextCardBtn" type="button">continue</button></div>
  <section id="practiceRemediation">
    <button id="remediationAcknowledgeBtn" type="button">acknowledge</button>
    <form id="remediationForm">
      <input id="remediationInput">
      <button id="remediationSubmitBtn" type="submit">submit</button>
    </form>
  </section>
  <button id="ordinaryControl" type="button">ordinary</button>
</body></html>`, {
  url: 'https://vocora.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;
let targetKeydowns = 0;
let legacyNextCards = 0;
let unrelatedVoiceStarts = 0;
let delayedContinues = 0;

for (const selector of ['#remediationAcknowledgeBtn', '#remediationInput']) {
  document.querySelector(selector).addEventListener('keydown', () => { targetKeydowns += 1; });
}
document.querySelector('#nextCardBtn').addEventListener('click', () => { delayedContinues += 1; });

window.eval(guardSource);
assert.equal(window.VocoraRemediationKeyboardGuard.install(document), false, 'Installing the guard twice must be idempotent.');
assert.equal(window.VocoraRemediationKeyboardGuard.loadReviewSessionUx(document), false, 'The review UX loader must be idempotent.');
assert.equal(document.querySelector('#vocora-review-session-ux-script')?.getAttribute('src'), 'review-session-ux.js');
assert.doesNotMatch(guardSource, /vocoraRemediationPreviewContinue/, 'The guard must not depend on a duplicated remediation Continue button.');

// Models app-v2's document-level Enter shortcut.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  legacyNextCards += 1;
  unrelatedVoiceStarts += 1;
});

function pressEnter(element) {
  const event = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

let event = pressEnter(document.querySelector('#remediationAcknowledgeBtn'));
assert.equal(targetKeydowns, 1, 'Enter must still reach the focused remediation action.');
assert.equal(legacyNextCards, 0, 'Enter on correction must not advance the underlying card.');
assert.equal(unrelatedVoiceStarts, 0);
assert.equal(event.defaultPrevented, false, 'The guard must preserve the control’s native Enter behavior.');

event = pressEnter(document.querySelector('#remediationInput'));
assert.equal(targetKeydowns, 2, 'Enter must still reach the remediation form input.');
assert.equal(legacyNextCards, 0);
assert.equal(unrelatedVoiceStarts, 0);
assert.equal(event.defaultPrevented, false, 'The guard must not cancel native form submission.');

// During the assessment preview, Enter outside remediation must reuse the same
// feedback Continue button, never a second duplicate CTA and never app-v2's
// global "next card" shortcut.
document.querySelector('#practiceRemediation').classList.add('vocora-remediation-delayed');
event = pressEnter(document.querySelector('#ordinaryControl'));
assert.equal(delayedContinues, 1, 'Enter must activate the shared feedback Continue action exactly once.');
assert.equal(legacyNextCards, 0, 'Delayed remediation must not be bypassed by the legacy shortcut.');
assert.equal(unrelatedVoiceStarts, 0);
assert.equal(event.defaultPrevented, true);
document.querySelector('#practiceRemediation').classList.remove('vocora-remediation-delayed');

event = pressEnter(document.querySelector('#ordinaryControl'));
assert.equal(legacyNextCards, 1, 'Enter outside remediation must retain the existing app shortcut.');
assert.equal(unrelatedVoiceStarts, 1);
assert.equal(event.defaultPrevented, true);

console.log('Remediation keyboard guard tests passed.');
