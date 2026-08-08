import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const domainSource = fs.readFileSync(new URL('../practice-remediation.js', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../review-session-ux.js', import.meta.url), 'utf8');
const controllerSource = fs.readFileSync(new URL('../practice-remediation-adapter.js', import.meta.url), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://vocora.test/',
  runScripts: 'outside-only'
});
const { window } = dom;
window.VazheyarReady = new Promise(() => {});
window.eval(domainSource);
window.eval(viewSource);
window.eval(controllerSource);

const {
  PracticeSessionWorkflow,
  PracticeStage,
  PracticeCommand
} = window.VocoraPracticeUI;

assert.equal(typeof PracticeSessionWorkflow, 'function', 'The workflow must be an explicit testable object.');
assert.ok(Object.isFrozen(PracticeStage));
assert.ok(Object.isFrozen(PracticeCommand));

const words = {
  alpha: { id: 'alpha', term: 'accommodation', accepted: ['accommodation'], category: 'Test', box: 1, notes: '' },
  beta: { id: 'beta', term: 'attendance', accepted: ['attendance'], category: 'Test', box: 1, notes: '' },
  gamma: { id: 'gamma', term: 'specialist', accepted: ['specialist'], category: 'Test', box: 1, notes: '' }
};

function fresh(mode = 'box1', policy = undefined) {
  const workflow = new PracticeSessionWorkflow({ domain: window.VocoraPractice, policy });
  workflow.begin(mode);
  assert.equal(workflow.snapshot().stage, PracticeStage.ANSWER);
  assert.equal(workflow.snapshot().mode, mode);
  return workflow;
}

function answer(workflow, word, value, { forcedWrong = false } = {}) {
  const correct = !forcedWrong && word.accepted.includes(value);
  return workflow.primaryAnswered({ word, answer: value, correct, forcedWrong });
}

function assertInvariant(workflow, message = 'workflow invariant') {
  const snapshot = workflow.snapshot();
  assert.ok(Object.values(PracticeStage).includes(snapshot.stage), `${message}: known stage`);
  if (snapshot.stage.startsWith('feedback-')) assert.ok(snapshot.feedback, `${message}: feedback exists`);
  if (snapshot.stage.startsWith('remediation-')) {
    assert.ok(snapshot.active, `${message}: remediation exists`);
    assert.equal(snapshot.active.presentationDeferred, false, `${message}: remediation is presented`);
  }
  if (snapshot.active?.presentationDeferred) {
    assert.ok(snapshot.stage.startsWith('feedback-'), `${message}: deferred remediation belongs to feedback`);
  }
}

// Correct primary answer: one feedback stage, then one primary advance.
{
  const workflow = fresh('box1');
  answer(workflow, words.alpha, 'accommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.FEEDBACK_CORRECT);
  assert.equal(workflow.snapshot().feedback.spelling, 'accommodation');
  assert.equal(workflow.continue().command, PracticeCommand.ADVANCE_PRIMARY);
  assert.equal(workflow.snapshot().stage, PracticeStage.ANSWER);
  assertInvariant(workflow);
}

// Scheduled mistakes keep the original Leitner retry behavior and do not open remediation.
{
  const workflow = fresh('scheduled');
  answer(workflow, words.alpha, 'acommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.FEEDBACK_WRONG);
  assert.equal(workflow.snapshot().active, null);
  assert.equal(workflow.continue().command, PracticeCommand.ADVANCE_PRIMARY);
  assertInvariant(workflow);
}

// Immediate correction, successful first recall, and a delayed same-session recheck.
{
  const workflow = fresh('box1');
  answer(workflow, words.alpha, 'acommodation');
  let snapshot = workflow.snapshot();
  assert.equal(snapshot.stage, PracticeStage.FEEDBACK_WRONG);
  assert.equal(snapshot.active.phase, 'correction');
  assert.equal(snapshot.active.presentationDeferred, true);

  assert.equal(workflow.continue().command, PracticeCommand.RENDER);
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_CORRECTION);
  workflow.acknowledge();
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_RECALL);
  workflow.submitRemediation('accommodation');
  snapshot = workflow.snapshot();
  assert.equal(snapshot.stage, PracticeStage.REMEDIATION_COMPLETED);
  assert.equal(snapshot.queue[0].remainingCards, 3);
  assert.equal(workflow.continue().command, PracticeCommand.ADVANCE_PRIMARY);
  assert.equal(workflow.snapshot().stage, PracticeStage.ANSWER);
  assertInvariant(workflow);
}

// Recall -> copy -> recall loop remains domain-driven and schedules a short retry after a failed recheck.
{
  const workflow = fresh('box1');
  answer(workflow, words.alpha, 'acommodation');
  workflow.continue();
  workflow.acknowledge();
  workflow.submitRemediation('acommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_COPY);
  workflow.submitRemediation('accomodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_COPY);
  workflow.submitRemediation('accommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_RECALL);
  workflow.submitRemediation('accommodation');
  workflow.continue();

  for (const word of [words.beta, words.gamma, words.beta]) {
    answer(workflow, word, word.term);
    const result = workflow.continue();
    if (result.command === PracticeCommand.RENDER) break;
  }
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_RECALL);
  assert.equal(workflow.snapshot().active.context, 'recheck');
  workflow.submitRemediation('acommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_COPY);
  workflow.submitRemediation('accommodation');
  workflow.submitRemediation('accommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_COMPLETED);
  assert.equal(workflow.snapshot().queue[0].remainingCards, 1);
  assertInvariant(workflow);
}

// Multiple due rechecks are ordered and never share ownership with primary feedback.
{
  const policy = new window.VocoraPractice.SameSessionRecheckPolicy({ initialGap: 0, retryGap: 0, maxRechecks: 2 });
  const workflow = fresh('box1', policy);
  workflow.scheduleRecheck({ word: words.alpha, mode: 'box1', recheckNumber: 1 }, 0);
  workflow.scheduleRecheck({ word: words.beta, mode: 'box1', recheckNumber: 1 }, 0);
  answer(workflow, words.gamma, 'specialist');
  assert.equal(workflow.snapshot().stage, PracticeStage.FEEDBACK_CORRECT);
  assert.equal(workflow.continue().command, PracticeCommand.RENDER);
  assert.equal(workflow.snapshot().active.wordId, 'alpha');
  workflow.submitRemediation('accommodation');
  assert.equal(workflow.continue().command, PracticeCommand.RENDER);
  assert.equal(workflow.snapshot().active.wordId, 'beta');
  assertInvariant(workflow);
}

// The last card in a finite new-word session flushes the nearest queued recheck before finishing.
{
  const workflow = fresh('new');
  workflow.scheduleRecheck({ word: words.alpha, mode: 'new', recheckNumber: 1 }, 2);
  answer(workflow, words.beta, 'attendance');
  const result = workflow.continue({ flush: true });
  assert.equal(result.command, PracticeCommand.RENDER);
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_RECALL);
  assert.equal(workflow.snapshot().active.wordId, 'alpha');
  assertInvariant(workflow);
}

// Reset is a real workflow boundary: no active attempt, feedback, or queue leaks into a new session.
{
  const workflow = fresh('box1');
  answer(workflow, words.alpha, 'acommodation');
  workflow.reset();
  let snapshot = workflow.snapshot();
  assert.equal(snapshot.stage, PracticeStage.IDLE);
  assert.equal(snapshot.active, null);
  assert.equal(snapshot.feedback, null);
  assert.deepEqual(snapshot.queue, []);
  workflow.begin('new');
  snapshot = workflow.snapshot();
  assert.equal(snapshot.stage, PracticeStage.ANSWER);
  assert.deepEqual(snapshot.queue, []);
}

// Model-style long run: after every transition exactly one deterministic stage is derivable.
{
  const workflow = fresh('box1');
  for (let index = 0; index < 60; index += 1) {
    const word = [words.alpha, words.beta, words.gamma][index % 3];
    const wrong = index % 7 === 0;
    answer(workflow, word, wrong ? `${word.term}x` : word.term);
    assertInvariant(workflow, `step ${index} feedback`);
    let result = workflow.continue();
    while (result.command === PracticeCommand.RENDER && workflow.snapshot().stage.startsWith('remediation-')) {
      const stage = workflow.snapshot().stage;
      if (stage === PracticeStage.REMEDIATION_CORRECTION) workflow.acknowledge();
      else if (stage === PracticeStage.REMEDIATION_RECALL) workflow.submitRemediation(workflow.snapshot().active.spelling);
      else if (stage === PracticeStage.REMEDIATION_COPY) workflow.submitRemediation(workflow.snapshot().active.spelling);
      else if (stage === PracticeStage.REMEDIATION_COMPLETED) result = workflow.continue();
      assertInvariant(workflow, `step ${index} remediation`);
    }
  }
}

console.log('Practice session workflow state-machine tests passed.');
