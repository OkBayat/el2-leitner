const REVIEW_STATUSES = new Set(['none', 'findings', 'blocked', 'clean']);
const VALIDATION_STATUSES = new Set(['none', 'failed', 'retry', 'passed']);
const PR_STATUSES = new Set(['none', 'waiting', 'valid_feedback', 'blocked', 'clean']);
const EVIDENCE_IDENTITY = /^(?:commit:[a-f0-9]{40}|worktree:sha256:[a-f0-9]{64})$/;
const ROOT_FIELDS = new Set([
  'current_identity',
  'contract_ready',
  'implementation_ready',
  'review_required',
  'focused_verification',
  'review',
  'final_validation',
  'closure',
  'publication',
]);
const STATUS_FIELDS = new Set(['status', 'identity']);
const PR_IDENTITY_FIELDS = new Set(['pr_number', 'head_identity']);
const PUBLICATION_FIELDS = new Set([
  'authorized',
  'pushed_identity',
  'pr_required',
  'pr_number',
  'pr_ready_for_review',
  'pr_ready_identity',
  'pr_status',
  'pr_identity',
]);

function fail(code) {
  throw new Error(code);
}

function assertBoolean(value, field) {
  if (typeof value !== 'boolean') fail(`TASK_DELIVERY_STATE_INVALID:${field}`);
}

function assertIdentity(value, field, { optional = false } = {}) {
  if (optional && value === null) return;
  if (typeof value !== 'string' || !EVIDENCE_IDENTITY.test(value)) {
    fail(`TASK_DELIVERY_STATE_INVALID:${field}`);
  }
}

function assertPrNumber(value, field, { optional = false } = {}) {
  if (optional && value === null) return;
  if (!Number.isInteger(value) || value < 1) {
    fail(`TASK_DELIVERY_STATE_INVALID:${field}`);
  }
}

function assertPrIdentity(value, field, { optional = false } = {}) {
  if (optional && value === null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`TASK_DELIVERY_STATE_INVALID:${field}`);
  }
  assertExactKeys(value, PR_IDENTITY_FIELDS, field);
  assertPrNumber(value.pr_number, `${field}.pr_number`);
  assertIdentity(value.head_identity, `${field}.head_identity`);
}

function assertStatus(value, allowed, field) {
  if (!allowed.has(value)) fail(`TASK_DELIVERY_STATE_INVALID:${field}`);
}

function assertExactKeys(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`TASK_DELIVERY_STATE_UNEXPECTED_FIELD:${field}.${key}`);
  }
}

function result(identity, phase, reason, action = 'continue') {
  return {
    schema_version: 1,
    current_identity: identity,
    phase,
    action,
    reason,
  };
}

function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    fail('TASK_DELIVERY_STATE_INVALID:root');
  }
  assertExactKeys(state, ROOT_FIELDS, 'root');
  assertIdentity(state.current_identity, 'current_identity');
  assertBoolean(state.contract_ready, 'contract_ready');
  assertBoolean(state.implementation_ready, 'implementation_ready');
  assertBoolean(state.review_required, 'review_required');

  const focused = state.focused_verification;
  if (!focused || typeof focused !== 'object') fail('TASK_DELIVERY_STATE_INVALID:focused_verification');
  assertExactKeys(focused, new Set(['passed', 'identity']), 'focused_verification');
  assertBoolean(focused.passed, 'focused_verification.passed');
  assertIdentity(focused.identity, 'focused_verification.identity', { optional: true });

  const review = state.review;
  if (!review || typeof review !== 'object') fail('TASK_DELIVERY_STATE_INVALID:review');
  assertExactKeys(review, STATUS_FIELDS, 'review');
  assertStatus(review.status, REVIEW_STATUSES, 'review.status');
  assertIdentity(review.identity, 'review.identity', { optional: true });

  const validation = state.final_validation;
  if (!validation || typeof validation !== 'object') fail('TASK_DELIVERY_STATE_INVALID:final_validation');
  assertExactKeys(validation, STATUS_FIELDS, 'final_validation');
  assertStatus(validation.status, VALIDATION_STATUSES, 'final_validation.status');
  assertIdentity(validation.identity, 'final_validation.identity', { optional: true });

  const closure = state.closure;
  if (!closure || typeof closure !== 'object') fail('TASK_DELIVERY_STATE_INVALID:closure');
  assertExactKeys(closure, new Set(['zero_gap_sweeps', 'identity']), 'closure');
  if (!Number.isInteger(closure.zero_gap_sweeps)
    || closure.zero_gap_sweeps < 0
    || closure.zero_gap_sweeps > 2) {
    fail('TASK_DELIVERY_STATE_INVALID:closure.zero_gap_sweeps');
  }
  assertIdentity(closure.identity, 'closure.identity', { optional: true });

  const publication = state.publication;
  if (!publication || typeof publication !== 'object') fail('TASK_DELIVERY_STATE_INVALID:publication');
  assertExactKeys(publication, PUBLICATION_FIELDS, 'publication');
  assertBoolean(publication.authorized, 'publication.authorized');
  assertBoolean(publication.pr_required, 'publication.pr_required');
  assertPrNumber(publication.pr_number, 'publication.pr_number', { optional: true });
  assertBoolean(publication.pr_ready_for_review, 'publication.pr_ready_for_review');
  assertIdentity(publication.pushed_identity, 'publication.pushed_identity', { optional: true });
  assertPrIdentity(publication.pr_ready_identity, 'publication.pr_ready_identity', { optional: true });
  assertStatus(publication.pr_status, PR_STATUSES, 'publication.pr_status');
  assertPrIdentity(publication.pr_identity, 'publication.pr_identity', { optional: true });

  if (focused.passed && focused.identity === null) fail('TASK_DELIVERY_STATE_INVALID:focused_verification.identity');
  if (review.status !== 'none' && review.identity === null) fail('TASK_DELIVERY_STATE_INVALID:review.identity');
  if (validation.status !== 'none' && validation.identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:final_validation.identity');
  }
  if (closure.zero_gap_sweeps > 0 && closure.identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:closure.identity');
  }
  if (!publication.pr_required && publication.pr_status !== 'none') {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_status');
  }
  if (!publication.pr_required && publication.pr_number !== null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_number');
  }
  if (publication.pr_required && publication.pr_number === null
    && (publication.pr_ready_for_review
      || publication.pr_ready_identity !== null
      || publication.pr_status !== 'none'
      || publication.pr_identity !== null)) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_number');
  }
  if (publication.pr_number !== null && publication.pushed_identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pushed_identity');
  }
  if (!publication.pr_required
    && (publication.pr_ready_for_review || publication.pr_ready_identity !== null)) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_ready_for_review');
  }
  if (publication.pr_ready_for_review && publication.pr_ready_identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_ready_identity');
  }
  if (publication.pr_status === 'none' && publication.pr_identity !== null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_identity');
  }
  if (publication.pr_required && !publication.authorized) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_required');
  }
  if (!publication.authorized && publication.pushed_identity !== null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pushed_identity');
  }
  if (publication.pr_ready_identity !== null && publication.pushed_identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pushed_identity');
  }
  if (publication.pr_status !== 'none' && publication.pushed_identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pushed_identity');
  }
  if (publication.pr_status !== 'none' && publication.pr_identity === null) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_identity');
  }
  if (publication.pr_status !== 'none' && !publication.pr_ready_for_review) {
    fail('TASK_DELIVERY_STATE_INVALID:publication.pr_ready_for_review');
  }
  if (publication.authorized && !state.review_required) {
    fail('TASK_DELIVERY_STATE_INVALID:review_required');
  }
  if (state.review_required && !state.current_identity.startsWith('commit:')) {
    fail('TASK_DELIVERY_STATE_INVALID:current_identity');
  }
}

export function workflowNextAction(state) {
  validateState(state);
  const identity = state.current_identity;

  if (!state.contract_ready) {
    return result(identity, 'CONTRACT', 'task_contract_missing');
  }
  if (!state.implementation_ready) {
    return result(identity, 'IMPLEMENT', 'implementation_incomplete');
  }

  if (state.review_required
    && state.review.status === 'findings'
    && state.review.identity === identity) {
    return result(identity, 'IMPLEMENT', 'actionable_review_finding');
  }
  if (state.review_required
    && state.review.status === 'blocked'
    && state.review.identity === identity) {
    return result(identity, 'REVIEW', 'review_blocked', 'blocked');
  }

  const focusedCurrent = state.focused_verification.passed
    && state.focused_verification.identity === identity;
  if (!focusedCurrent) {
    return result(identity, 'FOCUSED_VERIFY', 'focused_verification_stale_or_missing');
  }

  if (state.review_required) {
    const reviewCurrent = state.review.status === 'clean' && state.review.identity === identity;
    if (!reviewCurrent) {
      return result(identity, 'REVIEW', 'clean_review_stale_or_missing');
    }
  }

  if (state.final_validation.status === 'failed'
    && state.final_validation.identity === identity) {
    return result(identity, 'IMPLEMENT', 'final_validation_failed');
  }
  if (state.final_validation.status === 'retry'
    && state.final_validation.identity === identity) {
    return result(identity, 'FINAL_VALIDATION', 'final_validation_retry_authorized');
  }
  const validationCurrent = state.final_validation.status === 'passed'
    && state.final_validation.identity === identity;
  if (!validationCurrent) {
    return result(identity, 'FINAL_VALIDATION', 'final_validation_stale_or_missing');
  }

  const closureSweeps = state.closure.identity === identity
    ? state.closure.zero_gap_sweeps
    : 0;
  if (closureSweeps < 2) {
    return result(identity, 'CLOSURE', `zero_gap_sweeps_${closureSweeps}_of_2`);
  }

  if (!state.publication.authorized) {
    return result(identity, 'COMPLETE', 'all_local_gates_passed', 'completed');
  }
  if (state.publication.pushed_identity !== identity) {
    return result(identity, 'PUBLISH', 'current_identity_not_published');
  }
  if (state.publication.pr_required && state.publication.pr_number === null) {
    return result(identity, 'PUBLISH', 'required_pr_missing');
  }
  if (!state.publication.pr_required) {
    return result(identity, 'COMPLETE', 'all_publication_gates_passed', 'completed');
  }
  const prReadyCurrent = state.publication.pr_ready_for_review
    && state.publication.pr_ready_identity.pr_number === state.publication.pr_number
    && state.publication.pr_ready_identity.head_identity === identity;
  if (!prReadyCurrent) {
    return result(identity, 'PR_READY', 'pr_not_ready_for_review');
  }
  const prStatusCurrent = state.publication.pr_identity?.pr_number === state.publication.pr_number
    && state.publication.pr_identity?.head_identity === identity;
  if (!prStatusCurrent && state.publication.pr_status !== 'none') {
    return result(identity, 'PR_MONITOR', 'pr_status_stale');
  }
  if (state.publication.pr_status === 'valid_feedback') {
    return result(identity, 'IMPLEMENT', 'valid_pr_feedback');
  }
  if (state.publication.pr_status === 'blocked') {
    return result(identity, 'PR_MONITOR', 'pr_review_blocked', 'blocked');
  }
  if (state.publication.pr_status !== 'clean') {
    return result(identity, 'PR_MONITOR', 'pr_review_incomplete');
  }
  return result(identity, 'COMPLETE', 'all_pr_gates_passed', 'completed');
}
