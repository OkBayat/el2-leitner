---
name: k2-pre-push-review-loop
description: Run Vocora's reusable identity-bound code review loop after focused verification and before authorized publication. Use when a caller requires a clean review for an exact committed base-to-HEAD range.
---

# Vocora Pre-Push Review Loop

## Purpose

Review one exact committed change range before push or PR publication. This
skill validates the range, requests a read-only review through
`k2-requesting-code-review`, evaluates feedback through
`k2-receiving-code-review`, and repeats after valid fixes until no actionable
finding remains for the current HEAD.

## Required inputs

The caller must supply:

- `base_ref`: the accepted task base branch or ref;
- `review_base_sha`: the immutable full SHA recorded at task start;
- `branch_name`: the current task branch;
- `review_head_sha`: the exact committed HEAD;
- the Original Request or complete requirement ledger;
- explicit authority for any review-fix commit.

Do not substitute `HEAD~1`, an unrelated caller-provenance SHA, or an inferred
base.

## Workflow

1. Read `../k2-requesting-code-review/SKILL.md` and
   `../k2-requesting-code-review/k2-code-reviewer.md`.
2. Read `../k2-receiving-code-review/SKILL.md`.
3. Validate the exact range:

   ```bash
   rtk node .agents/skills/shared/code-review/scripts/pre-push-review-range.cjs \
     --base-ref "$BASE_REF" \
     --base-sha "$BASE_SHA" \
     --branch "$BRANCH" \
     --head-sha "$HEAD_SHA"
   ```

4. Continue only when the validator returns `action: ok`; use its exact
   `review_range`.
5. Dispatch one read-only reviewer with the Original Request, repository
   instructions, and validated range.
6. Verify every finding against the current Vocora code and contracts.
7. Apply only valid, in-scope, actionable fixes. Run focused checks for each
   changed surface.
8. When content changes, commit only if authorized, refresh `HEAD_SHA`,
   revalidate the range, and request review again.
9. Return `clean` only with the exact reviewed HEAD SHA and no actionable
   finding.

Do not run the caller's broad final suite inside this loop. The caller owns final
validation, closure, push, and PR publication.

## Stop conditions

Return `blocked` when an identity is missing or stale, range validation fails,
a reviewer cannot be dispatched or inspected, feedback requires guessing,
required verification fails, a fix needs authority the caller lacks, or the
clean reviewed HEAD cannot be identified.

## Determinism Boundary

### Script-owned

- `.agents/skills/shared/code-review/scripts/pre-push-review-range.cjs`
  validates the current branch, exact base and head, ancestry, canonical merge
  base, and returned review range.

### Codex-owned

- Build reviewer context from the accepted requirements.
- Verify findings, implement valid fixes, and choose focused checks.
- Record the exact clean reviewed HEAD.

### No manual fallback

- Do not reproduce a failed range validation manually.
- Do not invent review findings or declare a review clean when the reviewer or
  result is unavailable.
- Do not claim the caller's final validation inside this loop.
