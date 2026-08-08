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

function serializableSnapshot(workflow) {
  return JSON.parse(JSON.stringify(workflow.snapshot()));
}

function expectNoop(workflow, operation, label) {
  const before = serializableSnapshot(workflow);
  const result = operation();
  assert.equal(result.command, PracticeCommand.NONE, `${label}: command must be NONE`);
  assert.deepEqual(serializableSnapshot(workflow), before, `${label}: state must not change`);
}

function assertInvariant(workflow, message = 'workflow invariant') {
  const snapshot = workflow.snapshot();
  assert.ok(Object.values(PracticeStage).includes(snapshot.stage), `${message}: known stage`);
  if (snapshot.stage === PracticeStage.IDLE) {
    assert.equal(snapshot.mode, null, `${message}: idle has no mode`);
    assert.equal(snapshot.feedback, null, `${message}: idle has no feedback`);
    assert.equal(snapshot.active, null, `${message}: idle has no active remediation`);
  }
  if (snapshot.stage === PracticeStage.ANSWER) {
    assert.equal(snapshot.feedback, null, `${message}: answer has no feedback`);
    assert.equal(snapshot.active, null, `${message}: answer has no remediation`);
  }
  if (snapshot.stage.startsWith('feedback-')) {
    assert.ok(snapshot.feedback, `${message}: feedback exists`);
    if (snapshot.active) {
      assert.equal(snapshot.active.presentationDeferred, true, `${message}: active remediation is deferred behind feedback`);
    }
  }
  if (snapshot.stage.startsWith('remediation-')) {
    assert.ok(snapshot.active, `${message}: remediation exists`);
    assert.equal(snapshot.feedback, null, `${message}: remediation has no competing primary feedback`);
    assert.equal(snapshot.active.presentationDeferred, false, `${message}: remediation is presented`);
  }
}

// Every invalid command is a no-op in every stage. This is what prevents a
// second click, Enter, or stale asynchronous callback from skipping a stage.
{
  const workflow = new PracticeSessionWorkflow({ domain: window.VocoraPractice });
  expectNoop(workflow, () => workflow.continue(), 'idle continue');
  expectNoop(workflow, () => workflow.acknowledge(), 'idle acknowledge');
  expectNoop(workflow, () => workflow.submitRemediation('x'), 'idle remediation submit');

  workflow.begin('box1');
  expectNoop(workflow, () => workflow.continue(), 'answer continue');
  expectNoop(workflow, () => workflow.acknowledge(), 'answer acknowledge');
  expectNoop(workflow, () => workflow.submitRemediation('x'), 'answer remediation submit');

  answer(workflow, words.alpha, 'accommodation');
  expectNoop(workflow, () => answer(workflow, words.beta, 'attendance'), 'feedback duplicate primary answer');
  expectNoop(workflow, () => workflow.acknowledge(), 'feedback acknowledge');
  expectNoop(workflow, () => workflow.submitRemediation('x'), 'feedback remediation submit');
  assert.equal(workflow.continue().command, PracticeCommand.ADVANCE_PRIMARY);
  expectNoop(workflow, () => workflow.continue(), 'double continue after primary advance');

  answer(workflow, words.alpha, 'acommodation');
  expectNoop(workflow, () => answer(workflow, words.beta, 'attendance'), 'deferred feedback duplicate answer');
  expectNoop(workflow, () => workflow.acknowledge(), 'deferred feedback acknowledge');
  expectNoop(workflow, () => workflow.submitRemediation('accommodation'), 'deferred feedback submit');
  workflow.continue();
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_CORRECTION);
  expectNoop(workflow, () => workflow.continue(), 'correction continue');
  expectNoop(workflow, () => answer(workflow, words.beta, 'attendance'), 'correction primary answer');
  expectNoop(workflow, () => workflow.submitRemediation('accommodation'), 'correction submit');

  workflow.acknowledge();
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_RECALL);
  expectNoop(workflow, () => workflow.continue(), 'recall continue');
  expectNoop(workflow, () => workflow.acknowledge(), 'recall acknowledge');
  expectNoop(workflow, () => answer(workflow, words.beta, 'attendance'), 'recall primary answer');

  workflow.submitRemediation('wrong');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_COPY);
  expectNoop(workflow, () => workflow.continue(), 'copy continue');
  expectNoop(workflow, () => workflow.acknowledge(), 'copy acknowledge');
  expectNoop(workflow, () => answer(workflow, words.beta, 'attendance'), 'copy primary answer');

  workflow.submitRemediation('accommodation');
  workflow.submitRemediation('accommodation');
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_COMPLETED);
  expectNoop(workflow, () => workflow.acknowledge(), 'completed acknowledge');
  expectNoop(workflow, () => workflow.submitRemediation('accommodation'), 'completed submit');
  expectNoop(workflow, () => answer(workflow, words.beta, 'attendance'), 'completed primary answer');
  assertInvariant(workflow, 'complete transition matrix');
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

// Unknown answer has its own feedback kind but follows the same correction rule.
{
  const workflow = fresh('box1');
  answer(workflow, words.alpha, '', { forcedWrong: true });
  const snapshot = workflow.snapshot();
  assert.equal(snapshot.stage, PracticeStage.FEEDBACK_WARNING);
  assert.equal(snapshot.feedback.kind, 'warning');
  assert.equal(snapshot.feedback.spelling, 'accommodation');
  assert.equal(snapshot.active.presentationDeferred, true);
  workflow.continue();
  assert.equal(workflow.snapshot().stage, PracticeStage.REMEDIATION_CORRECTION);
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

// Reset is a real workflow boundary from every state and a new session cannot inherit queue/feedback.
{
  const builders = [
    () => fresh('box1'),
    () => { const workflow = fresh('box1'); answer(workflow, words.alpha, 'accommodation'); return workflow; },
    () => { const workflow = fresh('box1'); answer(workflow, words.alpha, 'wrong'); workflow.continue(); return workflow; },
    () => { const workflow = fresh('box1'); answer(workflow, words.alpha, 'wrong'); workflow.continue(); workflow.acknowledge(); return workflow; },
    () => { const workflow = fresh('box1'); answer(workflow, words.alpha, 'wrong'); workflow.continue(); workflow.acknowledge(); workflow.submitRemediation('wrong'); return workflow; },
    () => { const workflow = fresh('box1'); answer(workflow, words.alpha, 'wrong'); workflow.continue(); workflow.acknowledge(); workflow.submitRemediation('accommodation'); return workflow; }
  ];

  for (const [index, build] of builders.entries()) {
    const workflow = build();
    workflow.scheduleRecheck({ word: words.beta, mode: 'box1', recheckNumber: 1 }, 1);
    workflow.reset();
    let snapshot = workflow.snapshot();
    assert.equal(snapshot.stage, PracticeStage.IDLE, `reset state ${index}`);
    assert.equal(snapshot.active, null);
    assert.equal(snapshot.feedback, null);
    assert.equal(snapshot.queue.length, 0);
    workflow.begin('new');
    snapshot = workflow.snapshot();
    assert.equal(snapshot.stage, PracticeStage.ANSWER);
    assert.equal(snapshot.queue.length, 0);
    assertInvariant(workflow, `new session after reset ${index}`);
  }
}

// Snapshots are values, not mutable aliases into workflow state.
{
  const workflow = fresh('box1');
  answer(workflow, words.alpha, 'wrong');
  const snapshot = workflow.snapshot();
  snapshot.feedback.spelling = 'mutated';
  snapshot.feedback.word.accepted[0] = 'mutated';
  snapshot.active.word.accepted[0] = 'mutated';
  assert.equal(workflow.snapshot().feedback.spelling, 'accommodation');
  assert.equal(workflow.snapshot().feedback.word.accepted[0], 'accommodation');
  assert.equal(workflow.snapshot().active.word.accepted[0], 'accommodation');
}

// Model-style long run: after every transition exactly one deterministic stage is derivable.
{
  const workflow = fresh('box1');
  for (let index = 0; index < 100; index += 1) {
    const word = [words.alpha, words.beta, words.gamma][index % 3];
    const wrong = index % 7 === 0;
    const unknown = index % 19 === 0;
    answer(
      workflow,
      word,
      wrong || unknown ? `${word.term}x` : word.term,
      { forcedWrong: unknown }
    );
    assertInvariant(workflow, `step ${index} feedback`);
    let result = workflow.continue();
    let guard = 0;
    while (result.command === PracticeCommand.RENDER && workflow.snapshot().stage.startsWith('remediation-')) {
      guard += 1;
      assert.ok(guard < 30, `step ${index}: remediation must converge`);
      const stage = workflow.snapshot().stage;
      if (stage === PracticeStage.REMEDIATION_CORRECTION) workflow.acknowledge();
      else if (stage === PracticeStage.REMEDIATION_RECALL) workflow.submitRemediation(workflow.snapshot().active.spelling);
      else if (stage === PracticeStage.REMEDIATION_COPY) workflow.submitRemediation(workflow.snapshot().active.spelling);
      else if (stage === PracticeStage.REMEDIATION_COMPLETED) result = workflow.continue();
      assertInvariant(workflow, `step ${index} remediation ${guard}`);
    }
    assert.ok(
      [PracticeCommand.ADVANCE_PRIMARY, PracticeCommand.RENDER].includes(result.command),
      `step ${index}: valid terminal command`
    );
  }
}

console.log('Practice session workflow state-machine tests passed.');
