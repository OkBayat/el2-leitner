import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workflowNextAction } from '../lib/workflow-next-action.mjs';

const SCRIPT = fileURLToPath(new URL('../workflow-next-action.mjs', import.meta.url));
const COMMIT_A = `commit:${'a'.repeat(40)}`;
const COMMIT_B = `commit:${'b'.repeat(40)}`;
const WORKTREE_A = `worktree:sha256:${'c'.repeat(64)}`;
const PR_A = 3714;
const PR_B = 3715;

function prEvidence(prNumber, headIdentity) {
  return { pr_number: prNumber, head_identity: headIdentity };
}

function state(overrides = {}) {
  return {
    current_identity: COMMIT_A,
    contract_ready: true,
    implementation_ready: true,
    review_required: true,
    focused_verification: { passed: true, identity: COMMIT_A },
    review: { status: 'clean', identity: COMMIT_A },
    final_validation: { status: 'passed', identity: COMMIT_A },
    closure: { zero_gap_sweeps: 2, identity: COMMIT_A },
    publication: {
      authorized: false,
      pushed_identity: null,
      pr_required: false,
      pr_number: null,
      pr_ready_for_review: false,
      pr_ready_identity: null,
      pr_status: 'none',
      pr_identity: null,
    },
    ...overrides,
  };
}

function route(overrides) {
  return workflowNextAction(state(overrides));
}

function testContractAndImplementationOrder() {
  assert.equal(route({ contract_ready: false }).phase, 'CONTRACT');
  assert.equal(route({ implementation_ready: false }).phase, 'IMPLEMENT');
}

function testReviewFindingsWinBeforeVerification() {
  const result = route({
    focused_verification: { passed: false, identity: null },
    review: { status: 'findings', identity: COMMIT_A },
  });
  assert.equal(result.phase, 'IMPLEMENT');
  assert.equal(result.reason, 'actionable_review_finding');
}

function testFocusedVerificationPrecedesReview() {
  const focused = workflowNextAction(state({
    focused_verification: { passed: false, identity: null },
    review: { status: 'none', identity: null },
    final_validation: { status: 'none', identity: null },
    closure: { zero_gap_sweeps: 0, identity: null },
  }));
  assert.equal(focused.phase, 'FOCUSED_VERIFY');

  assert.equal(route({
    review: { status: 'none', identity: null },
    final_validation: { status: 'none', identity: null },
    closure: { zero_gap_sweeps: 0, identity: null },
  }).phase, 'REVIEW');
}

function testCleanReviewPrecedesFinalValidation() {
  assert.equal(route({
    final_validation: { status: 'none', identity: null },
    closure: { zero_gap_sweeps: 0, identity: null },
  }).phase, 'FINAL_VALIDATION');
}

function testUnpublishedLocalWorkCanSkipPrePushReview() {
  assert.equal(route({
    review_required: false,
    review: { status: 'none', identity: null },
    final_validation: { status: 'none', identity: null },
    closure: { zero_gap_sweeps: 0, identity: null },
  }).phase, 'FINAL_VALIDATION');

  assert.equal(route({
    current_identity: WORKTREE_A,
    review_required: false,
    focused_verification: { passed: true, identity: WORKTREE_A },
    review: { status: 'none', identity: null },
    final_validation: { status: 'none', identity: null },
    closure: { zero_gap_sweeps: 0, identity: null },
  }).phase, 'FINAL_VALIDATION');
}

function testValidationFailureDoesNotSkipBackToReviewWithoutAChange() {
  const failure = workflowNextAction(state({
    final_validation: { status: 'failed', identity: COMMIT_A },
    closure: { zero_gap_sweeps: 0, identity: null },
  }));
  assert.equal(failure.phase, 'IMPLEMENT');
  assert.equal(failure.reason, 'final_validation_failed');
}

function testNoChangeValidationRetryIsExplicit() {
  const retry = route({
    final_validation: { status: 'retry', identity: COMMIT_A },
    closure: { zero_gap_sweeps: 0, identity: null },
  });
  assert.equal(retry.phase, 'FINAL_VALIDATION');
  assert.equal(retry.reason, 'final_validation_retry_authorized');
}

function testContentChangeInvalidatesReviewAndValidation() {
  assert.equal(route({
    current_identity: COMMIT_B,
    focused_verification: { passed: true, identity: COMMIT_A },
    review: { status: 'clean', identity: COMMIT_A },
    final_validation: { status: 'passed', identity: COMMIT_A },
    closure: { zero_gap_sweeps: 2, identity: COMMIT_A },
  }).phase, 'FOCUSED_VERIFY');

  assert.equal(route({
    current_identity: COMMIT_B,
    focused_verification: { passed: true, identity: COMMIT_B },
    review: { status: 'clean', identity: COMMIT_A },
    final_validation: { status: 'passed', identity: COMMIT_A },
    closure: { zero_gap_sweeps: 2, identity: COMMIT_A },
  }).phase, 'REVIEW');
}

function testClosureRequiresTwoCurrentIdentitySweeps() {
  assert.equal(route({
    closure: { zero_gap_sweeps: 0, identity: null },
  }).phase, 'CLOSURE');
  assert.equal(route({
    closure: { zero_gap_sweeps: 1, identity: COMMIT_A },
  }).phase, 'CLOSURE');
  assert.equal(route().action, 'completed');
}

function testPublicationAndPrLoop() {
  const publication = {
    authorized: true,
    pushed_identity: null,
    pr_required: true,
    pr_number: null,
    pr_ready_for_review: false,
    pr_ready_identity: null,
    pr_status: 'none',
    pr_identity: null,
  };
  assert.equal(route({ publication }).phase, 'PUBLISH');
  const pushedWithoutPr = route({
    publication: { ...publication, pushed_identity: COMMIT_A },
  });
  assert.equal(pushedWithoutPr.phase, 'PUBLISH');
  assert.equal(pushedWithoutPr.reason, 'required_pr_missing');

  const published = { ...publication, pushed_identity: COMMIT_A, pr_number: PR_A };
  assert.equal(route({ publication: published }).phase, 'PR_READY');
  assert.equal(route({
    publication: {
      ...published,
      pr_ready_for_review: true,
      pr_ready_identity: prEvidence(PR_A, COMMIT_A),
    },
  }).phase, 'PR_MONITOR');
  assert.equal(route({
    publication: {
      ...published,
      pr_ready_for_review: true,
      pr_ready_identity: prEvidence(PR_A, COMMIT_A),
      pr_status: 'valid_feedback',
      pr_identity: prEvidence(PR_A, COMMIT_A),
    },
  }).phase, 'IMPLEMENT');
  assert.equal(route({
    publication: {
      ...published,
      pr_ready_for_review: true,
      pr_ready_identity: prEvidence(PR_A, COMMIT_A),
      pr_status: 'clean',
      pr_identity: prEvidence(PR_A, COMMIT_A),
    },
  }).action, 'completed');
}

function testStalePrStatusCannotCompleteCurrentIdentity() {
  for (const prStatus of ['clean', 'blocked', 'valid_feedback']) {
    const result = route({
      current_identity: COMMIT_B,
      focused_verification: { passed: true, identity: COMMIT_B },
      review: { status: 'clean', identity: COMMIT_B },
      final_validation: { status: 'passed', identity: COMMIT_B },
      closure: { zero_gap_sweeps: 2, identity: COMMIT_B },
      publication: {
        authorized: true,
        pushed_identity: COMMIT_B,
        pr_required: true,
        pr_number: PR_A,
        pr_ready_for_review: true,
        pr_ready_identity: prEvidence(PR_A, COMMIT_B),
        pr_status: prStatus,
        pr_identity: prEvidence(PR_A, COMMIT_A),
      },
    });
    assert.equal(result.phase, 'PR_MONITOR');
    assert.equal(result.reason, 'pr_status_stale');
  }
}

function testStalePrReadinessReturnsToReadyGate() {
  const result = route({
    current_identity: COMMIT_B,
    focused_verification: { passed: true, identity: COMMIT_B },
    review: { status: 'clean', identity: COMMIT_B },
    final_validation: { status: 'passed', identity: COMMIT_B },
    closure: { zero_gap_sweeps: 2, identity: COMMIT_B },
    publication: {
      authorized: true,
      pushed_identity: COMMIT_B,
      pr_required: true,
      pr_number: PR_A,
      pr_ready_for_review: true,
      pr_ready_identity: prEvidence(PR_A, COMMIT_A),
      pr_status: 'clean',
      pr_identity: prEvidence(PR_A, COMMIT_A),
    },
  });
  assert.equal(result.phase, 'PR_READY');
  assert.equal(result.reason, 'pr_not_ready_for_review');
}

function testPrEvidenceCannotCrossPrBoundary() {
  const staleReadiness = route({
    publication: {
      authorized: true,
      pushed_identity: COMMIT_A,
      pr_required: true,
      pr_number: PR_B,
      pr_ready_for_review: true,
      pr_ready_identity: prEvidence(PR_A, COMMIT_A),
      pr_status: 'none',
      pr_identity: null,
    },
  });
  assert.equal(staleReadiness.phase, 'PR_READY');
  assert.equal(staleReadiness.reason, 'pr_not_ready_for_review');

  const staleReview = route({
    publication: {
      authorized: true,
      pushed_identity: COMMIT_A,
      pr_required: true,
      pr_number: PR_B,
      pr_ready_for_review: true,
      pr_ready_identity: prEvidence(PR_B, COMMIT_A),
      pr_status: 'clean',
      pr_identity: prEvidence(PR_A, COMMIT_A),
    },
  });
  assert.equal(staleReview.phase, 'PR_MONITOR');
  assert.equal(staleReview.reason, 'pr_status_stale');
}

function testPrNumberLifecycleFailsClosed() {
  assert.throws(
    () => route({
      publication: {
        authorized: true,
        pushed_identity: COMMIT_A,
        pr_required: true,
        pr_number: null,
        pr_ready_for_review: true,
        pr_ready_identity: prEvidence(PR_A, COMMIT_A),
        pr_status: 'clean',
        pr_identity: prEvidence(PR_A, COMMIT_A),
      },
    }),
    /TASK_DELIVERY_STATE_INVALID:publication.pr_number/,
  );
  assert.throws(
    () => route({
      publication: {
        authorized: true,
        pushed_identity: null,
        pr_required: true,
        pr_number: PR_A,
        pr_ready_for_review: false,
        pr_ready_identity: null,
        pr_status: 'none',
        pr_identity: null,
      },
    }),
    /TASK_DELIVERY_STATE_INVALID:publication.pushed_identity/,
  );
}

function testBlockedAndInvalidStatesFailClosed() {
  assert.equal(route({
    review: { status: 'blocked', identity: COMMIT_A },
  }).action, 'blocked');
  assert.throws(
    () => workflowNextAction(state({
      review: { status: 'clean', identity: null },
    })),
    /TASK_DELIVERY_STATE_INVALID:review.identity/,
  );
  assert.throws(
    () => workflowNextAction(state({
      closure: { zero_gap_sweeps: 3, identity: COMMIT_A },
    })),
    /TASK_DELIVERY_STATE_INVALID:closure.zero_gap_sweeps/,
  );
  assert.throws(
    () => workflowNextAction(state({
      review_required: false,
      publication: {
        authorized: true,
        pushed_identity: null,
        pr_required: false,
        pr_number: null,
        pr_ready_for_review: false,
        pr_ready_identity: null,
        pr_status: 'none',
        pr_identity: null,
      },
    })),
    /TASK_DELIVERY_STATE_INVALID:review_required/,
  );
  assert.throws(
    () => workflowNextAction(state({
      current_identity: WORKTREE_A,
      focused_verification: { passed: true, identity: WORKTREE_A },
    })),
    /TASK_DELIVERY_STATE_INVALID:current_identity/,
  );
  assert.throws(
    () => route({ unexpected_field: true }),
    /TASK_DELIVERY_STATE_UNEXPECTED_FIELD:root.unexpected_field/,
  );
  assert.throws(
    () => route({
      publication: {
        authorized: false,
        pushed_identity: null,
        pr_required: false,
        pr_number: null,
        pr_ready_for_review: false,
        pr_ready_identity: null,
        pr_status: 'none',
        pr_identity: null,
        pr_status_alias: 'clean',
      },
    }),
    /TASK_DELIVERY_STATE_UNEXPECTED_FIELD:publication.pr_status_alias/,
  );
  assert.throws(
    () => route({
      publication: {
        authorized: true,
        pushed_identity: COMMIT_A,
        pr_required: true,
        pr_number: PR_A,
        pr_ready_for_review: false,
        pr_ready_identity: prEvidence(PR_A, COMMIT_A),
        pr_status: 'waiting',
        pr_identity: prEvidence(PR_A, COMMIT_A),
      },
    }),
    /TASK_DELIVERY_STATE_INVALID:publication.pr_ready_for_review/,
  );
}

function testCliReturnsCanonicalResult() {
  const directory = mkdtempSync(join(tmpdir(), 'k2-task-delivery-router-'));
  const input = join(directory, 'state.json');
  writeFileSync(input, JSON.stringify(state({
    final_validation: { status: 'none', identity: null },
    closure: { zero_gap_sweeps: 0, identity: null },
  })));
  const result = spawnSync(process.execPath, [SCRIPT, '--input', input], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    schema_version: 1,
    current_identity: COMMIT_A,
    phase: 'FINAL_VALIDATION',
    action: 'continue',
    reason: 'final_validation_stale_or_missing',
  });

  writeFileSync(input, '{invalid');
  const invalid = spawnSync(process.execPath, [SCRIPT, '--input', input], {
    encoding: 'utf8',
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /TASK_DELIVERY_STATE_JSON_INVALID/);
}

testContractAndImplementationOrder();
testReviewFindingsWinBeforeVerification();
testFocusedVerificationPrecedesReview();
testCleanReviewPrecedesFinalValidation();
testUnpublishedLocalWorkCanSkipPrePushReview();
testValidationFailureDoesNotSkipBackToReviewWithoutAChange();
testNoChangeValidationRetryIsExplicit();
testContentChangeInvalidatesReviewAndValidation();
testClosureRequiresTwoCurrentIdentitySweeps();
testPublicationAndPrLoop();
testStalePrStatusCannotCompleteCurrentIdentity();
testStalePrReadinessReturnsToReadyGate();
testPrEvidenceCannotCrossPrBoundary();
testPrNumberLifecycleFailsClosed();
testBlockedAndInvalidStatesFailClosed();
testCliReturnsCanonicalResult();

process.stdout.write('test-workflow-next-action: ok\n');
