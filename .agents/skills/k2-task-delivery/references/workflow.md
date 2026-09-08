# Task Delivery Workflow

Load this reference only after `k2-task-delivery` selects the task-delivery
route. This document owns the phase contracts. The executable
`workflow-next-action.mjs` router owns their priority and next action.

## Canonical graph

```text
CONTRACT
  -> IMPLEMENT
  -> FOCUSED_VERIFY
  -> REVIEW                         when review_required
       findings -> IMPLEMENT -> FOCUSED_VERIFY -> REVIEW
       clean    -> FINAL_VALIDATION
  -> FINAL_VALIDATION
       pass -> CLOSURE
       fail with a content fix -> FOCUSED_VERIFY -> REVIEW -> FINAL_VALIDATION
       fail without a change -> explicit retry -> FINAL_VALIDATION
  -> CLOSURE
       gap -> IMPLEMENT -> FOCUSED_VERIFY -> REVIEW -> FINAL_VALIDATION
       two zero-gap sweeps -> PUBLISH or COMPLETE
  -> PUBLISH                        only when authorized
  -> PR_READY                       only when a PR is required
  -> PR_MONITOR                     only when a PR is required
       valid feedback -> IMPLEMENT
       clean -> COMPLETE
```

There is no path from a review finding directly to final validation and no path
from a content-changing validation fix directly back to broad validation.

## Evidence identity

Use one identity for every phase result:

- committed mode: `commit:<full_head_sha>`;
- uncommitted mode: `worktree:<worktree_fingerprint>`, returned by the
  validation-scope selector.

Git, the requirement ledger, selector output, test results, review output, and
GitHub are authoritative. The router input is a temporary projection, not a
second durable state source. Do not commit it.

Any repository content change creates a new identity and invalidates focused
verification, clean review, final validation, and closure evidence. PR reads,
comments, reactions, and other external-only operations do not change local
content identity.

## Router input

Run:

```bash
rtk node .agents/skills/k2-task-delivery/scripts/workflow-next-action.mjs \
  --input <current-evidence-projection.json>
```

The input contains:

- `current_identity`;
- `contract_ready`;
- `implementation_ready`;
- `review_required`;
- `focused_verification`: `passed` and `identity`;
- `review`: `status` (`none`, `findings`, `blocked`, `clean`) and
  `identity`;
- `final_validation`: `status` (`none`, `failed`, `retry`, `passed`)
  and `identity`;
- `closure`: `zero_gap_sweeps` and `identity`;
- `publication`: `authorized`, `pushed_identity`, `pr_required`,
  `pr_number`, ready-for-review evidence, and `pr_status` (`none`,
  `waiting`, `valid_feedback`, `blocked`, `clean`).

A PR identity is an exact `{ pr_number, head_identity }` pair. `pr_number`
remains null until a real PR is created or reused and read back. Publication
requires review, so the router rejects `publication.authorized: true` when
`review_required` is false.

The result contains `phase`, `action`, `reason`, and the current identity.
Unknown or contradictory input fails closed.

## Phase contracts

### CONTRACT

Record the repository instructions, applicable skills, exact base branch and
SHA, current branch and status, pre-existing dirty files, Original Request, and
external-write authorization.

Create one ledger row per atomic requirement:

| ID | Exact requirement | Kind | Implementation evidence | Verification evidence | Status |
|---|---|---|---|---|---|

Kinds are `behavior`, `test`, `docs`, `contract`, `migration`,
`operation`, and `constraint`. Statuses are `pending`,
`implemented_unverified`, `verified`, `blocked`, and `not_applicable`.

Exit only when scope, base, authorization, and every requirement are explicit.

### IMPLEMENT

Inspect only the canonical Vocora producer, consumer, contract, persistence
boundary, tests, and documentation that participate. Implement the smallest
complete vertical slice. Preserve public IDs, learner progress, persisted
attempts, production data, and backward-compatible behavior unless the request
explicitly changes them.

For bug fixes and deterministic behavior, add or update a focused regression
before implementation. Do not add aliases, speculative compatibility, or
adjacent cleanup.

When review is required, commit the intended content only if commit authority
was granted, so review can bind to an exact HEAD.

### FOCUSED_VERIFY

Run syntax checks, unit or regression tests, and narrow validators for the
changed surface. Bind the passing result to the current identity.

### REVIEW

Invoke `k2-pre-push-review-loop` with the recorded base reference, immutable
base SHA, current branch, and committed HEAD. The review loop validates the
range, requests a read-only review, verifies findings, applies only valid
in-scope fixes, and repeats focused verification and review after each changed
HEAD.

Do not run broad final validation inside this cycle. Exit with an identity-bound
`clean` result or an explicit blocker.

### FINAL_VALIDATION

Load [validation-scope.md](validation-scope.md), run its selector, and execute
the selected `full`, `focused`, or `none` action plus explicitly required
owning-domain checks.

If a fix changes content, discard old review and validation evidence and return
to `FOCUSED_VERIFY`. If diagnosis proves no content change is required, record
`final_validation.status: retry` for the same identity.

### CLOSURE

For each sweep:

1. Refresh exact HEAD or fingerprint, changed files, and verification evidence.
2. Reread the Original Request line by line and map it to the ledger.
3. Recheck verified rows across producer, consumer, data, and UI boundaries.
4. Check asymmetric completion, including docs without behavior, producer
   without consumer, migration without compatibility, and success without
   failure handling.
5. Confirm review and validation identities still match.

A content-changing gap resets closure. Proceed only after two consecutive
zero-gap sweeps on one identity.

### PUBLISH

Enter only after two closure sweeps and explicit publication authorization.
Push the reviewed, validated, closed identity. Create or reuse a PR only when
required, and read back its real number. Do not infer push, PR, merge, or
deployment permission.

### PR_READY

If the exact pushed PR is a draft, mark it ready only when authorized. Read back
the PR number, state, and head and record exact ready-for-review evidence.

### PR_MONITOR

Vocora has no local review-service dependency. Read GitHub directly with the available
connector or `gh` CLI and bind observations to the exact PR number and pushed
head. Inspect:

- current PR head;
- unresolved actionable review feedback;
- reported CI checks;
- mergeability.

This phase is observation-only. Do not edit, commit, push, reply, resolve, or
merge. Project an exact result into `publication.pr_status`:

- `waiting`: reported checks or required reviews are pending;
- `valid_feedback`: actionable code, CI, or merge-conflict feedback exists;
- `blocked`: GitHub state or tooling cannot be trusted;
- `clean`: the exact-head read found no actionable feedback, no failing or
  pending reported check, and no merge conflict.

If no checks are reported, record that fact and report CI as unreported; never
describe it as green. Poll or wait only when the user requested monitoring or
the owning workflow explicitly requires it.

### COMPLETE

Report the base and final identities, requirement ledger status, changed files,
focused and final commands, selector result, clean review identity, both closure
sweeps, publication identity, PR state, observed or unreported CI, and any
intentionally unrun verification.

## Capability and lazy-load matrix

| Phase | Load | Allowed effects |
|---|---|---|
| CONTRACT | repository and domain contracts | read state; create temporary ledger evidence |
| IMPLEMENT | owning domain references | task-scoped edits and authorized local commits |
| FOCUSED_VERIFY | changed-surface test contracts | local tests and validators |
| REVIEW | `k2-pre-push-review-loop` | read-only reviewer handoff; task-scoped fixes and authorized local commits |
| FINAL_VALIDATION | `validation-scope.md` | local tests and validators |
| CLOSURE | Original Request, ledger, diff | read-only audit |
| PUBLISH | publication tooling | explicitly authorized push and PR writes |
| PR_READY | current PR summary | authorized ready-for-review write and readback |
| PR_MONITOR | current GitHub PR state | read only |
| COMPLETE | none | report only |

## Determinism Boundary

### Script-owned

- Validate router input and return one legal phase and action.
- Enforce phase priority, identity invalidation, PR readiness, and validation
  scope.
- Reject unknown fields, invalid statuses, stale identities, impossible closure
  counts, and publication without review.

### Codex-owned

- Build the ledger and evidence projection.
- Verify review and PR feedback against Vocora contracts.
- Choose changed-surface checks and the broadest relevant suite required by the
  selector.
- Implement fixes and record exact observed evidence.

### No manual fallback

- Do not skip or reorder the router action.
- Do not downgrade selector output or treat stale evidence as current.
- Do not declare review or CI clean without an exact current observation.
