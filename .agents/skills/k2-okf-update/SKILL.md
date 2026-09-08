---
name: k2-okf-update
description: Update the Vocora root OKF knowledge bundle from durable project learning. Use only when the user explicitly asks to add, refresh, or review project knowledge in OKF, especially from the current session or a specified scope.
---

# Vocora OKF Update

## Overview

Update `okf/**` only. Capture durable, evidence-backed Vocora project knowledge
in the root Open Knowledge Format bundle. Do not import project-specific
knowledge from another repository.

## Scope

Default scope is the current session. If the user names a different scope, use
that scope instead, such as the last project task or a specific transcript,
issue, branch, pull request, file, or workflow.

## Workflow

1. Follow the repository-required principle selection before mutation, then
   return execution to this skill.
2. Inspect only the requested evidence scope and the existing `okf/**` files
   needed to place the knowledge without duplication.
3. Refresh an existing concept when the scope shows stale knowledge, broken
   links, or stronger current evidence for an already-recorded fact.
4. Extract durable project knowledge only when it is supported by the requested
   evidence. Do not record guesses, temporary debugging facts, secrets,
   credentials, raw logs, raw transcripts, or personal data.
5. Update only OKF content for a knowledge-only request:
   * concept files under `okf/**`;
   * relevant `index.md` files;
   * `okf/log.md`.
6. Run the canonical validator from the repository root:

   ```bash
   python3 .agents/skills/k2-okf-update/scripts/validate_okf.py
   ```

7. Publish only when the user has explicitly authorized the requested commit,
   push, or pull-request operations.

## OKF Rules

Follow OKF v0.1 as implemented in this repository:

* A bundle is a directory tree of Markdown files.
* `index.md` is reserved for progressive disclosure.
* `log.md` is reserved for date-grouped update history.
* Other `.md` files are concepts and must start with YAML frontmatter.
* Concept frontmatter must include a non-empty `type`; prefer `title`,
  `description`, `tags`, and `timestamp`.
* Use bundle-relative absolute links, such as `/project/example.md`, when
  linking between OKF concepts.
* Put each durable fact in one authoritative concept and link to it elsewhere.
* List evidence under `# Citations` when a concept makes sourced claims.
* Keep source files and repository documentation authoritative when they conflict
  with stale OKF content; correct the OKF rather than overriding source truth.

## Stop Conditions

Stop and report instead of writing OKF when:

* the only available knowledge is uncertain or contradicted by source evidence;
* a knowledge-only request would require changing files outside `okf/**`;
* unrelated changes would be mixed into the requested knowledge update;
* the requested evidence scope cannot be inspected;
* a suspected stale concept or broken link cannot be verified from the requested
  scope;
* the OKF validator fails and the failure cannot be fixed within the requested
  scope.

## Determinism Boundary

### Script-owned

- `scripts/validate_okf.py` validates the root bundle, reserved root files,
  supported OKF version, concept frontmatter, and required concept `type`, then
  emits canonical JSON and a deterministic exit code.
- `scripts/test_validate_okf.py` verifies the validator's stable acceptance and
  rejection behavior.

### Codex-owned

- Interpret the requested evidence scope.
- Decide whether information is durable, supported, and worth recording.
- Choose the authoritative concept and wording without duplicating facts.
- Update indexes and the log to preserve progressive disclosure and history.

### No manual fallback

- Do not bypass or reinterpret a failing validator result.
- Do not invent evidence, silently copy project-specific knowledge from another
  repository, or record uncertain claims as facts.
- Fix the OKF content or validator within scope, otherwise stop with the exact
  blocker.
