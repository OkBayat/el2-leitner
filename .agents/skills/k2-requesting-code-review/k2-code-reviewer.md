# Vocora Code Reviewer Prompt Template

Use this template for an independent read-only review.

```text
You are reviewing a completed Vocora change against its accepted requirements.

## What was implemented

[DESCRIPTION]

## Requirements

[PLAN_OR_REQUIREMENTS]

## Exact Git range

Base: [BASE_SHA]
Head: [HEAD_SHA]

Inspect the range and surrounding contracts read-only. Do not edit files,
change Git state, run production or deployment commands, or write to GitHub.

Check:

- every requested behavior, constraint, test, operation, and report item is
  covered;
- backend Domain/Application/Infrastructure/Interface ownership is preserved;
- Angular service/state/component boundaries are preserved;
- standard UI primitives use Angular Material and presentational helpers use
  existing Bootstrap utilities and centralized theme tokens;
- public IDs, learner progress, completed attempt snapshots, and persisted data
  remain compatible unless the request explicitly changes them;
- migrations and persistence changes preserve integrity and rollback safety;
- agent-facing contracts use one canonical name and update producers,
  consumers, validators, tests, fixtures, and docs together;
- tests cover real behavior, edge cases, and failure paths;
- no ignored media, generated output, secrets, production data, or unrelated
  files are modified;
- no unauthorized push, PR, merge, deployment, or production operation is
  introduced.

Return:

### Issues

Group actionable findings as Critical, Important, or Minor. For each finding,
include file and line, the concrete failure mode, why it matters, and the
smallest valid correction.

### Assessment

Ready to proceed: Yes | No | With fixes
Reason: one or two evidence-based sentences.

Do not manufacture praise, speculate about uninspected code, or block on
optional cleanup.
```

Replace `[DESCRIPTION]`, `[PLAN_OR_REQUIREMENTS]`, `[BASE_SHA]`, and
`[HEAD_SHA]` with exact task evidence.
