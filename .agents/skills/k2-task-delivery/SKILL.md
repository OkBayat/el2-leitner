---
name: k2-task-delivery
description: Deliver multi-stage Vocora implementation requests to verified closure without dropping requirements. Use when work spans several behaviors, files, contracts, migrations, test surfaces, documentation changes, or authorized publication steps.
---

# K2 Task Delivery

Treat the request supplied with this skill as the immutable **Original Request**.
Vocora repository instructions and the smallest owning domain skill remain
authoritative.

This `SKILL.md` is the only mandatory skill-local initial instruction file.
After selecting this route, load
[references/workflow.md](references/workflow.md).
Load [references/validation-scope.md](references/validation-scope.md) only when
the router returns `phase: FINAL_VALIDATION`.

## Global invariants

- Preserve every imperative, acceptance criterion, constraint, prohibited
  action, operation, and reporting requirement in one atomic ledger.
- Record the exact task base branch and SHA before implementation.
- Use one exact `commit:<full_head_sha>` or
  `worktree:<worktree_fingerprint>` identity for focused verification,
  review, final validation, closure, publication, and PR evidence.
- Run quick focused checks after each implementation change.
- When publication requires review, obtain an identity-bound pre-push review
  through `k2-pre-push-review-loop` before final selected validation.
- Any content change invalidates focused verification, review, validation, and
  closure evidence from the previous identity.
- Require two consecutive zero-gap closure sweeps on the same identity after
  final validation.
- Keep `publication.pr_required` equal to the accepted request. Keep
  `publication.pr_number` null until a real PR has been created or reused and
  read back.
- Do not infer commit, push, PR, merge, deployment, production command, or
  external-write permission.
- Do not create a committed workflow-state artifact or a second state database.

## Required input and authorization

Record before task work:

- the Original Request;
- exact task base branch and SHA;
- current branch, HEAD, and `git status --short`;
- pre-existing dirty files;
- explicit authorization for commit, push, PR, merge, deployment, or other
  external writes;
- domain skills and tests explicitly required by the request.

Resolve only ambiguity that would materially change behavior or scope.

## State machine

```text
CONTRACT
  -> IMPLEMENT
  -> FOCUSED_VERIFY
  -> REVIEW (when required)
  -> FINAL_VALIDATION
  -> CLOSURE
  -> PUBLISH (when authorized)
  -> PR_READY (when a PR is required)
  -> PR_MONITOR (when a PR is required)
  -> COMPLETE
```

A review finding, final-validation fix, closure gap, or valid PR feedback returns
through `IMPLEMENT -> FOCUSED_VERIFY`. Review and broad validation are never
reused after the identity changes.

## Canonical transition facade

Project authoritative facts into a temporary JSON file and run:

```bash
rtk node .agents/skills/k2-task-delivery/scripts/workflow-next-action.mjs \
  --input <current-evidence-projection.json>
```

For `action: continue`, execute only the returned phase. `blocked` and
`completed` are terminal actions. Refresh the projection after every result or
identity change. The full state contract and legal graph are in
[references/workflow.md](references/workflow.md).

## Phase router

### CONTRACT

Load `references/workflow.md`. Establish the immutable request, requirement
ledger, base identity, current state, and authorization.

### IMPLEMENT

Use the smallest owning Vocora domain skill and the returned `reason`. Make only
the task-scoped change, then return to focused verification.

### FOCUSED_VERIFY

Run changed-surface checks and bind passing evidence to the current identity.

### REVIEW

Use `k2-pre-push-review-loop` for the exact committed base-to-HEAD range.
Actionable findings return through implementation and focused verification.
A clean result advances to final validation.

### FINAL_VALIDATION

Load `references/validation-scope.md`. Run the selector and the broadest
relevant Vocora checks it requires.

### CLOSURE

Reread the Original Request and perform two consecutive zero-gap sweeps without
repeating the broad suite.

### PUBLISH

Use only explicitly authorized publication operations for the reviewed,
validated, closed identity. Read back any created or reused PR number.

### PR_READY

If the PR is a draft, mark it ready only when authorized, then read back its
state and exact head identity.

### PR_MONITOR

Do not use a local review service. Read the exact PR head,
reported CI checks, review feedback, and mergeability from GitHub using the
available connector or CLI. Treat unreported checks as unreported, not green.
Apply no content change inside this phase; valid feedback returns to
`IMPLEMENT`. Wait or monitor only when the user requested it or the owning
workflow explicitly requires it.

### COMPLETE

Report exact evidence and perform no new effect.

## Stop conditions

Stop as `blocked` when:

- a required action needs authority the user did not grant;
- canonical evidence or identity cannot be obtained;
- review, validation, CI, or required tooling cannot produce a trustworthy
  result;
- feedback is contradictory or unsafe without a material user choice;
- a required ledger row cannot be verified.

Pending or unreported CI, stale evidence, one closure sweep, or a clean-looking
summary is not proof of completion.

## Completion

Use `complete` only when every applicable ledger row is verified or
evidence-backed not-applicable; focused verification, required review, selected
final validation, both closure sweeps, and authorized publication all match the
current identity; and every required PR gate has an exact current observation.

Report identities, changed files, exact commands and results, both closure
sweeps, publication state, observed CI/review state, and intentionally unrun
verification.

## Determinism Boundary

### Script-owned

- Validate the evidence projection and return one canonical phase plus
  `continue`, `blocked`, or `completed`.
- Enforce phase priority, exact identity invalidation, PR readiness, and
  validation-scope classification.
- Select and report working-tree or commit identity without mutating content.

### Codex-owned

- Build the requirement ledger and evidence projection from authoritative
  sources.
- Judge review findings against Vocora contracts and accepted scope.
- Choose the smallest focused checks and the broadest relevant final suite.
- Implement task-scoped fixes and record observed evidence.

### No manual fallback

- Do not reorder phases, bypass stale identity, downgrade validation scope,
  declare review or CI clean without evidence, or reuse evidence after content
  changes.
- Fix the canonical input or tooling, or stop with the exact blocker.
