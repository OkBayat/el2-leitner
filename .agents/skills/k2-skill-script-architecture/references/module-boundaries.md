# Module Boundaries

Use this reference only when planning a new multi-module skill script or
splitting a legacy script.

## Contents

- Boundary test
- Default module map
- Legacy split sequence
- Patterns to reject
- Review checklist

## Boundary test

A module should have one reason to change and one vocabulary. Split when a file
mixes two or more of these concerns:

- CLI argument parsing, output formatting, or process exit codes;
- workflow/state transitions;
- domain rules and policy decisions;
- schema or evidence validation;
- filesystem, GitHub, network, or process adapters;
- serialization, rendering, or report generation;
- hashing, caching, or identity construction;
- telemetry and timing;
- compatibility translation.

Do not split solely to satisfy a line count. The extracted module must own a
complete concern and expose a narrow contract.

## Default module map

Use only the modules the workflow actually needs:

```text
scripts/
  command.js              thin executable entrypoint
  lib/
    constants.js          frozen domain vocabulary
    state-machine.js      transitions and next-action rules
    events.js             event construction and reduction
    validators.js         validation orchestration
    evidence.js           derived evidence and rendering
    hashing.js            content identity and fingerprints
    repository.js         filesystem or process adapter
    telemetry.js          timing and counters
```

Split validators further by domain when one validator module would own several
independent contracts. Keep constants close to their owning module unless the
same vocabulary is genuinely shared.

## Dependency direction

Prefer this direction:

```text
entrypoint -> application workflow -> domain modules
                                \-> infrastructure adapters
```

Domain modules must not import the CLI. Rendering must consume domain results,
not recompute decisions. Telemetry must observe workflow events, not decide the
next state. Compatibility translation belongs at an input/output boundary.

## Legacy split sequence

1. Capture current behavior with focused characterization tests.
2. Identify the concern touched by the requested change.
3. Extract that complete concern without changing its contract.
4. Run the characterization tests.
5. Make the requested behavior change in the extracted module.
6. Add focused tests for the new behavior.
7. Remove obsolete forwarding exports and imports.
8. Run the architecture validator and inspect the dependency graph.

Prefer one-way extraction. Avoid a new module that immediately imports most of
the original monolith or requires callbacks for its internal decisions.

## Patterns to reject

- `utils.js`, `helpers.js`, or `common.js` as dumping grounds;
- a facade with dozens of exported internals;
- validation mixed with mutation or process execution;
- state transitions duplicated between CLI and renderer;
- a new file containing only forwarding wrappers;
- circular imports resolved with lazy `require()` calls;
- one test file covering unrelated modules through a full CLI process;
- large inline fixtures that can be stored as focused fixture files;
- `@generated` added to hand-written code to bypass validation.

## Review checklist

- Can each module's responsibility be described without using “and”?
- Does each rule have one authoritative implementation?
- Is the public facade smaller than the internal module graph?
- Can domain behavior be tested without filesystem, network, or child process
  access?
- Does a dependency arrow point toward a more stable concern?
- Did the touched legacy file measurably shrink?
- Are new modules below the ceilings with room for future changes?
