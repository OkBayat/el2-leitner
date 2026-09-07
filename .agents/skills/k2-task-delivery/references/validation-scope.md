# Validation Scope

Load this reference only after focused verification and every required pre-push
review are clean for the current identity. The selector decides whether the
change needs the broadest relevant Vocora regression suite or focused
validation.

## Canonical selector

For a committed checkpoint:

```bash
node .agents/skills/k2-task-delivery/scripts/validation-scope.mjs \
  --base <validation_checkpoint_sha> --head HEAD
```

This mode requires a clean worktree and returns `input_state: commit`.

When commit authority was not granted:

```bash
node .agents/skills/k2-task-delivery/scripts/validation-scope.mjs \
  --base <task_base_sha> --worktree
```

Working-tree mode includes committed, staged, unstaged, and non-ignored
untracked content relative to the task base. It returns a
`worktree_fingerprint`. Rerun it after verification and during closure; the
fingerprint and changed-file set must remain identical.

Git output and cumulative non-ignored untracked content are bounded at 64 MiB.
Exceeding the bound or observing a changing snapshot fails closed.

For a verified behavior-neutral skill-script extraction only, add:

```bash
--change-kind structural_only
```

The selector returns canonical JSON containing:

- `input_state`: `commit` or `worktree`;
- `validation_scope`: `full`, `focused`, or `none`;
- `full_suite_required`;
- exact base and head SHAs;
- `worktree_fingerprint`;
- sorted changed files grouped as `behavior`, `test`, `fixture`, and
  `documentation`.

Do not replace the selector with manual path classification.

## Vocora classification

Behavior-bearing surfaces include:

- `back/**`, including application, persistence, migrations, scripts, and
  managed-data contracts;
- `ui/**`, except recognized test and fixture files;
- `speech/**` and root `scripts/**`;
- `.agents/**` and `.github/**`;
- configuration, dependencies, CI, schemas, migrations, and unknown file types.

Documentation under `docs/**` and standard root documentation files is
focused-only unless an owning workflow says otherwise. Recognized test files,
test trees, fixtures, and snapshots are focused-only. Operational contracts
remain behavior-bearing even when a nested folder is named `tests` or
`fixtures`.

## Actions

### `full`

Run the broadest relevant suite for each behavior-bearing surface plus focused
checks for changed files. This means the owning surface's regression suite, not
an unrelated server-wide command.

- Backend behavior: from `back/`, run `rtk npm test` unless a narrower
  authoritative domain suite fully covers the change and repository
  instructions permit it.
- UI behavior: from `ui/`, run `rtk npm test`; use focused Angular or
  architecture checks first for fast feedback.
- Speech behavior: run the documented speech tests relevant to the changed
  module.
- Agent-skill behavior: run each changed skill's focused tests and quick
  validator, then both skill architecture validators. Do not run backend or
  UI suites solely because an agent skill changed.
- Listening episode work: run the canonical episode validator and every
  integration check required by its owning skill.
- Changes spanning several surfaces require the union of their owning checks.

Record exact commands and results. A failed or unrun required suite advances no
evidence identity.

### `focused`

Run tests, validators, syntax checks, lint, or documentation checks directly
covering the reported files. Changed tests must pass. Do not claim application
behavior coverage from a documentation-only check.

`structural_only` is valid only when every behavior-bearing file is an
executable implementation file under `.agents/skills/**/scripts/**`, the
change only moves a cohesive responsibility, and no algorithm, branch,
protected literal, command, schema, validation rule, effect, or public behavior
changes. Focused characterization tests and both architecture validators must
pass. When equivalence is uncertain, omit the override.

### `none`

No repository content changed between the checkpoint and current identity. Do
not rerun local tests.

## Checkpoints and invalidation

After a committed validation passes, record its exact HEAD as
`validation_checkpoint_sha`. Record `full_suite_checkpoint_sha` only after a
full result passes. In working-tree mode, bind evidence to the exact
fingerprint and do not invent a commit checkpoint.

Any content-changing fix invalidates focused verification, review, validation,
and closure evidence. Return through focused verification and required review.
External PR reads or replies do not change local identity.

Generated artifacts changed by validation must be handled through their owning
workflow before evidence is accepted. Never delete ignored media, production
data, or foreign untracked files to obtain a clean status.

## Evidence

Record selector JSON, every chosen command and result, exact successful
identities, and any explicit owning-domain override. Report unrun or
unobservable checks as such.
