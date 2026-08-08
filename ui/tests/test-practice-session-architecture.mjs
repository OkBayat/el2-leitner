import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const index = read('index.html');
const router = read('practice-session-keyboard-router.js');
const view = read('review-session-ux.js');
const controller = read('practice-remediation-adapter.js');
const prompt = read('practice-remediation-recheck-prompt.js');
const packageJson = JSON.parse(read('package.json'));

const scriptOrder = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((match) => match[1].split('?')[0]);

assert.deepEqual(
  scriptOrder.filter((name) => [
    'practice-remediation.js',
    'practice-session-keyboard-router.js',
    'review-session-ux.js',
    'app-v2.js',
    'practice-remediation-adapter.js',
    'practice-remediation-recheck-prompt.js'
  ].includes(name)),
  [
    'practice-remediation.js',
    'practice-session-keyboard-router.js',
    'review-session-ux.js',
    'app-v2.js',
    'practice-remediation-adapter.js',
    'practice-remediation-recheck-prompt.js'
  ],
  'Practice modules must load in one deterministic dependency order.'
);
assert.equal(
  scriptOrder.includes('practice-remediation-keyboard-guard.js'),
  false,
  'The obsolete compatibility alias must not be loaded.'
);
assert.equal(
  fs.existsSync(new URL('practice-remediation-keyboard-guard.js', root)),
  false,
  'The obsolete compatibility alias must be deleted, not left dormant.'
);

// The keyboard adapter owns only transport. It must never recreate the workflow.
assert.match(router, /VocoraPracticeRemediation/);
assert.match(router, /controller\.handleEnter\(event\)/);
assert.match(router, /windowObject\.addEventListener\('keydown', handler, true\)/);
assert.doesNotMatch(router, /PracticeStage|RemediationPhase|presentationDeferred|querySelector|#answer|#practiceRemediation/,
  'Keyboard routing must delegate to the controller instead of inferring stages or DOM state.');

// The view is a pure renderer of a supplied snapshot.
assert.match(view, /class PracticeSessionView/);
assert.match(view, /render\(snapshot\)/);
assert.doesNotMatch(view, /VocoraPracticeRemediation|PracticeSessionWorkflow|presentationDeferred/,
  'The view must not read or duplicate workflow state.');
assert.doesNotMatch(view, /MutationObserver/,
  'The view must not infer business state from DOM mutations.');
assert.doesNotMatch(view, /addEventListener\(['"](?:click|submit|keydown)['"],\s*\(event\)\s*=>\s*this\.(?:capture|handle)/,
  'The view must not own global practice commands.');
assert.doesNotMatch(view, /clearOriginalFeedbackContent/,
  'The remediation renderer must not contain a destructive feedback-clearing operation.');
assert.match(view, /if \(spelling && feedback\.spelling\) spelling\.textContent = feedback\.spelling/,
  'The feedback renderer must restore spelling from the immutable workflow snapshot.');
assert.doesNotMatch(view, /spelling\.textContent\s*=\s*['"]\s*['"]/,
  'The shared feedback spelling node must never be cleared by the renderer.');

// Exactly one controller/state machine owns every practice transition.
assert.match(controller, /class PracticeSessionWorkflow/);
assert.match(controller, /class PracticeSessionController/);
assert.match(controller, /const PracticeStage = Object\.freeze/);
assert.match(controller, /primaryAnswered\(/);
assert.match(controller, /continue\(/);
assert.match(controller, /acknowledge\(/);
assert.match(controller, /submitRemediation\(/);
assert.match(controller, /handleEnter\(event\)/);
assert.match(controller, /this\.view\.render\(snapshot\)/);
assert.doesNotMatch(controller, /class SpellingRemediationView|clearOriginalFeedbackContent/,
  'The controller must use the shared renderer and must not embed a second view implementation.');

// The prompt service may decorate recall audio readiness, but it cannot change stages.
assert.match(prompt, /same-session-recheck-started/);
assert.doesNotMatch(prompt, /PracticeStage|workflow\.(?:continue|acknowledge|primaryAnswered)|nextCardBtn\.click/,
  'The audio prompt coordinator must not advance or mutate the practice workflow.');

const testCommand = packageJson.scripts.test;
for (const required of [
  'test-practice-session-architecture.mjs',
  'test-practice-session-workflow.mjs',
  'test-practice-session-controller.mjs',
  'test-practice-session-real-app.mjs',
  'test-practice-remediation-recheck-prompt.mjs'
]) {
  assert.match(testCommand, new RegExp(required.replace('.', '\\.')));
}
for (const obsolete of [
  'test-practice-remediation-adapter.mjs',
  'test-remediation-keyboard-guard.mjs',
  'test-review-session-ux.mjs',
  'test-review-session-desktop-ux.mjs',
  'test-review-remediation-ownership.mjs'
]) {
  assert.doesNotMatch(testCommand, new RegExp(obsolete.replace('.', '\\.')));
  assert.equal(
    fs.existsSync(new URL(`tests/${obsolete}`, root)),
    false,
    `${obsolete} must be removed instead of preserving a second architecture.`
  );
}

console.log('Practice session architecture constraints passed.');
