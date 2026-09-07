---
name: k2-requesting-code-review
description: Request an independent read-only review of a completed Vocora change against its requirements and exact Git range. Use before authorized publication or when a fresh technical review is explicitly required.
---

# Vocora Requesting Code Review

Dispatch an independent reviewer with only the evidence needed to inspect the
work product. The reviewer must not mutate the worktree, index, HEAD, branch, or
external systems.

## Inputs

- a concise implementation summary;
- the Original Request or complete requirement ledger;
- exact immutable `BASE_SHA` and `HEAD_SHA`;
- applicable Vocora repository and domain contracts.

Use a caller-supplied base SHA when present. Otherwise resolve the merge base of
the accepted task base ref and HEAD. Never default to `HEAD~1`.

## Request

Use [k2-code-reviewer.md](k2-code-reviewer.md) as the prompt template. Supply the
exact Git range and ask the reviewer to inspect it read-only.

After the reviewer returns:

- reproduce or verify every reported issue;
- fix Critical and Important issues that are valid and in scope;
- treat Minor items as non-blocking unless they violate an accepted requirement;
- push back with code, contract, or test evidence when a finding is wrong;
- ask the user when feedback requires a material product or architecture choice.

## Determinism Boundary

### Script-owned

- Git resolves the exact base and head identities.

### Codex-owned

- Build the review context, dispatch the read-only reviewer, and verify findings.

### No manual fallback

- Do not invent findings when independent review cannot be dispatched or read.
- Do not allow the reviewer to modify local or external state.
