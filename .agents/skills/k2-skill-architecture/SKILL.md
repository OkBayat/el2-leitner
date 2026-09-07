---
name: k2-skill-architecture
description: Enforce simple, deterministic, testable, phase-aware architecture when creating or changing Vocora skills or shared skill assets. Use before any structural or behavioral change under .agents/skills/**; additionally use k2-skill-script-architecture when executable JavaScript or TypeScript changes.
---

# Vocora Skill Architecture

Keep Vocora skills easy to understand, cheap to load, safe to change, and deterministic
wherever the work can be expressed as code.

This file is the only mandatory initial instruction file. Read
[architecture-rules.md](references/architecture-rules.md) only when deciding
ownership, extracting shared behavior, or reviewing a non-trivial skill design.
Read [phased-workflow-architecture.md](references/phased-workflow-architecture.md)
only when a skill has multiple lifecycle stages, conditional lanes, durable
state, retries, rollback, external handoffs, resume behavior, or material lazy-
loading requirements.

## Scope

Apply this skill before creating, changing, moving, or deleting:

- a Vocora `SKILL.md`;
- skill references, scripts, schemas, assets, or tests;
- shared skill assets;
- validation or CI behavior that governs Vocora skills.

Do not use it to redesign unrelated application code or migrate untouched legacy
skills.

## Required workflow

1. Inspect the target skill and only the shared assets it directly uses.
2. Classify the requested workflow as simple or phased before choosing files or
   modules.
3. State the requested behavior and the smallest ownership boundary that can
   implement it.
4. Classify every new file as skill-owned or shared-domain-owned.
5. Define the Determinism Boundary before implementation.
6. For a phased workflow, define durable state, lanes, phases, transition
   ownership, lazy-load boundaries, resume identity, and terminal behavior before
   changing prose or scripts.
7. Write or update focused tests before deterministic script behavior.
8. Implement the smallest coherent change.
9. When executable JavaScript or TypeScript changes, also apply
   `k2-skill-script-architecture` and run its validator.
10. Run focused tests and this skill's validator before finalizing.

## Workflow complexity decision

Keep a workflow simple when it is linear, short, stateless, non-resumable, and
uses one bounded instruction set. Do not add ceremonial phases to a small skill.

Use phased workflow architecture when any of these is true:

- three or more meaningful lifecycle stages exist;
- different lanes require different references, adapters, or capabilities;
- the workflow can pause for a worker, review, user, or named-skill handoff;
- retry, rollback, compensation, or stale-snapshot handling is required;
- state must survive process or context interruption;
- deterministic routing must choose among several valid next actions;
- eager instruction or module loading is materially larger than the active path.

For these workflows, use the complete contract in
[phased-workflow-architecture.md](references/phased-workflow-architecture.md).

## Ownership rules

- Behavior used by one skill stays inside that skill.
- Behavior genuinely used by at least two skills may move to
  `shared/<domain>/`.
- New shared assets must be grouped by domain, not dumped directly into generic
  `shared/references/` or `shared/scripts/` folders.
- A skill must not read private `references/`, `scripts/`, `schemas/`, `assets/`,
  or `contracts/` from another skill. Use a shared domain asset or a named skill
  handoff instead.
- Each rule, schema, state transition, and machine-readable contract has one
  authoritative owner.
- Do not add manifests, package versions, registries, generators, or abstraction
  layers unless an active requirement proves they are necessary.

## Context and token rules

- Keep `SKILL.md` focused on routing, invariants, workflow, and stop conditions.
- Treat `SKILL.md` as the only mandatory skill-local initial instruction file.
- Load detailed references only in the phase that needs them.
- Make the current phase identify the exact `required_refs`; do not preload every
  reference because a later lane might need it.
- Scan summaries before details and hydrate only the selected issue, PR, task,
  candidate, or artifact.
- Route the command or phase before loading command-specific or phase-specific
  script modules.
- Link to canonical shared rules instead of restating them.
- Do not create reference files that only repeat `SKILL.md`.
- Prefer one focused reference over several tiny files with the same owner.
- For a materially large workflow, measure initial mandatory context and the
  largest phase-lazy context; treat regressions as architecture changes.

## Deterministic workflow rule

Codex should manage the workflow, not reimplement repeatable operations manually.
When an operation has stable inputs, rules, and outputs, make it script-owned.

Script-owned work normally includes:

- parsing, validation, calculation, and comparison;
- identifier, path, command, and evidence generation;
- state transitions, phase selection, and `next_action` derivation;
- deterministic file mutation, rollback, compensation, and finalization;
- stale-snapshot, resume-token, and postcondition validation;
- machine-readable result construction.

Codex-owned work is limited to:

- routing the request to the correct skill;
- reading script results and executing the returned next action;
- bounded domain judgment that cannot be encoded without losing meaning;
- choosing among script-validated options and recording the reason;
- reporting decisions and unresolved ambiguity.

A deterministic operation must not have a prose-only manual fallback. Fix the
script or stop with an explicit blocker.

## Phased workflow rule

A phased skill must satisfy all of these rules:

- Separate durable external state from internal runtime phases and returned
  actions. Do not create a durable label or file for every phase.
- Keep one authoritative transition function or workflow facade. Prose explains
  the graph; scripts derive the actual next state and `next_action`.
- Give every phase one purpose and an explicit contract: entry condition,
  inputs, preconditions, required references, handler, allowed capabilities,
  effects, output, legal successors, retry identity, compensation, and terminal
  status.
- Make the router select one lane and phase before detail hydration, reference
  loading, module loading, or mutation.
- Bind every paused handoff to immutable identity such as source commit, entity
  ID, head OID, input hash, or result digest. Resume must revalidate that identity
  and fail closed when stale.
- Separate observation and decision from mutation. Execute writes only through a
  narrow effect boundary with explicit postconditions.
- Make retries idempotent or explicitly authorized. Never infer that a partially
  completed mutation is safe to repeat.
- Lazy-load domain adapters and phase modules behind stable result contracts; do
  not make the core import every skill kind or future lane.
- Preserve one canonical state/evidence source and derive summaries, reports, and
  PR artifacts from it.

## Testability rules

- Use TDD for new deterministic behavior and characterization tests before
  changing legacy behavior.
- Every added, removed, renamed, or behavior-changed executable script must
  include a focused test change in the same skill or shared domain.
- Comment-only script changes do not require unrelated test churn.
- Keep CLI parsing and process exit behavior thin.
- Keep domain rules callable without filesystem, network, GitHub, or child
  process access.
- Put infrastructure access behind narrow adapters.
- Test domain decisions directly; use CLI tests only for command boundaries.
- Keep tests with the owning skill or shared domain.
- For phased workflows, test legal and illegal transitions, router priority,
  terminal states, stale resume, retry/idempotency, rollback or compensation,
  and mutation postconditions.
- Add regression checks proving unrelated references and modules are not loaded
  for representative commands and phases.
- When context size is material, test or regenerate the context measurement used
  by the workflow contract.

## Validation

From the repository root:

```bash
rtk proxy find .agents/skills/k2-skill-architecture/scripts -maxdepth 1 \
  -type f -name 'test-*.js' -print0 \
  | rtk proxy sort -z \
  | rtk proxy xargs -0 -n1 rtk node
rtk node .agents/skills/k2-skill-architecture/scripts/validate-skill-architecture.js \
  --base <base-sha> --head HEAD
```

For a working-tree inspection:

```bash
rtk node .agents/skills/k2-skill-architecture/scripts/validate-skill-architecture.js \
  --files .agents/skills/<skill>/SKILL.md
```

The validator returns canonical JSON and a non-zero exit code on failure. Do not
bypass failures with allowlists, ignored paths, aliases, or manual approval.

## Completion evidence

Report:

- the simple-versus-phased workflow classification;
- ownership decisions;
- the Determinism Boundary;
- for phased workflows, the state/phase graph, transition owner, resume and
  rollback rules, and lazy-load matrix;
- initial and largest-phase context measurements when context cost is material;
- tests added or updated;
- exact validation commands and results;
- any judgment that intentionally remains Codex-owned.

## Determinism Boundary

### Script-owned

- Detect changed skills and shared assets.
- Validate skill identity, deterministic-boundary sections, shared-domain paths,
  private sibling dependencies, local references, and minimum test presence.
- Return stable machine-readable findings and the next action.

### Codex-owned

- Decide whether behavior is truly reusable across domains.
- Classify a workflow as simple or phased and choose the smallest coherent phase
  boundaries.
- Evaluate domain semantics that cannot be reduced to stable mechanical rules.
- Choose the smallest valid design when several structures pass validation.

### No manual fallback

- Do not declare a skill architecture-valid when the validator fails.
- Do not manually perform a repeatable operation that the owning script is
  required to perform.
