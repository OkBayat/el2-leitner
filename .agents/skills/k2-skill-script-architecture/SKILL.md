---
name: k2-skill-script-architecture
description: Enforce modular, bounded architecture when creating, changing, reviewing, or refactoring executable JavaScript or TypeScript under .agents/skills/**/scripts/**. Use before any skill-script code edit, especially for oversized legacy scripts, broad module.exports surfaces, mixed CLI/domain/I/O responsibilities, or new validators and automation helpers.
---

# Vocora Skill Script Architecture

Keep skill automation cheap for Codex to inspect, safe to change, and easy to
test. Apply this skill before editing executable code under
`.agents/skills/**/scripts/**`.

## Required workflow

1. Run the architecture validator before editing to record the touched files'
   current metrics.
2. Name the responsibilities the change needs. Do not start coding until each
   responsibility has one intended module.
3. Keep the executable entrypoint thin. Move domain logic, validation, state,
   rendering, hashing, persistence, process execution, and telemetry into
   separate modules when more than one is present.
4. Make the smallest behavior change inside the resulting boundary.
5. Mirror module boundaries in focused tests.
6. Run syntax checks, focused tests, and the architecture validator before
   finishing.

Read [module-boundaries.md](references/module-boundaries.md) when choosing a
module map or splitting a legacy script.

## Non-negotiable limits

Apply these limits to manually maintained `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`,
and `.mts` files under a skill's `scripts/` directory:

- implementation module: at most 500 executable lines;
- test module: at most 700 executable lines;
- executable entrypoint or facade: at most 8 exported bindings;
- other implementation module: at most 12 exported bindings;
- no circular relative imports between skill-script modules;
- no new behavior in a generated file or fixture;
- no barrel file that republishes every internal helper.

Executable lines exclude blank lines and comments. Limits are architecture
ceilings, not targets. Prefer substantially smaller modules.

## Public API rule

Expose workflow capabilities, not implementation details. A normal facade
should export a small set such as `prepare`, `plan`, `ingestTest`,
`nextAction`, and `finalize`. Tests may import internal modules directly; do not
expand the public facade only to make private helpers testable.

Keep CLI parsing and process exit behavior in the entrypoint. Make the modules
behind it callable without spawning a process.

## Touched legacy scripts

Treat an existing file as legacy-oversized when it exceeds its line or export
limit before the change.

If only comments or documentation change, preserve the file and do not trigger
an unrelated refactor.

If executable behavior changes in a legacy-oversized file:

1. Extract at least one complete responsibility into a new sibling module.
2. Reduce the original file by at least 10% of its executable lines or 50
   executable lines, whichever is greater.
3. Reduce an oversized export surface rather than adding to it.
4. Keep every new module within all limits.
5. Do not introduce forwarding wrappers that merely move lines while retaining
   the same mixed ownership.

This mandatory extraction is part of the requested skill-script change scope.
Do not use the repository's surgical-change rule to keep adding behavior to a
known monolith.

## Generated files

The validator exempts a file only when its header contains `@generated`. Never
add that marker to manually maintained code. Change the generator and regenerate
the output instead.

## Determinism Boundary

### Script-owned

- Discover changed executable skill scripts, compute executable-line and export
  metrics, resolve module ownership, and emit canonical architecture findings.
- Apply the documented limits and legacy-reduction rules without allowlists or
  inline suppression.

### Codex-owned

- Choose cohesive responsibility boundaries and interpret whether an extraction
  preserves the owning workflow contract.
- Fix reported architecture violations and verify the resulting module graph.

### No manual fallback

- Do not waive validator findings, add generated markers to maintained code, or
  substitute manual line counts for the canonical validator result.

## Validation

From the repository root, run:

```bash
node .agents/skills/k2-skill-script-architecture/scripts/test-validate-skill-scripts.js
node .agents/skills/k2-skill-script-architecture/scripts/validate-skill-scripts.js \
  --base <base-sha> --head HEAD
```

For a pre-edit report of named files, run:

```bash
node .agents/skills/k2-skill-script-architecture/scripts/validate-skill-scripts.js \
  --files .agents/skills/<skill>/scripts/<file>.js
```

Do not suppress a failure with an allowlist or inline ignore. Split the module
or correct the dependency boundary.

## Completion evidence

Report:

- the responsibility-to-module map;
- before/after executable line and export counts for each legacy file;
- the exact architecture validation command and result;
- focused test commands and results.
