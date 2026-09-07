# Phased Skill Workflow Architecture

Read this reference only when designing, reviewing, or refactoring a Vocora skill
whose workflow is genuinely multi-stage, conditional, resumable, stateful, or
materially expensive to load.

This contract is the canonical Vocora design guide for phase graphs, deterministic
transitions, lazy context, lazy modules, resumable handoffs, effect boundaries,
and migration of large skill workflows. Keep `SKILL.md` as the router and use
this reference for the detailed design.

## 1. Purpose

A large skill should behave like a small deterministic workflow engine, not a
long prompt that Codex must reinterpret from the beginning on every invocation.
The architecture must make the current state, allowed action, required context,
and mutation boundary explicit.

The design goals are:

- deterministic routing and transitions;
- bounded instruction and runtime loading;
- one source of truth for state and evidence;
- safe pause, resume, retry, rollback, and compensation;
- narrow ownership and extension points;
- direct unit testing of decisions without infrastructure;
- observable, machine-readable outcomes;
- incremental migration from legacy monoliths.

## 2. When phases are required

Use phases when the workflow has any of these properties:

- three or more meaningful lifecycle stages;
- several command or work lanes with different priorities;
- phase-specific references or domain policies;
- external workers, reviews, user decisions, or named-skill handoffs;
- durable state that survives process or context interruption;
- retry, rollback, compensation, cleanup, or stale-input handling;
- several mutation types with different authorization boundaries;
- domain-specific adapters selected from a stable kind or mode;
- a material difference between eager context and the active path.

Do not phase a small linear workflow only to appear architectural. A phase must
have at least one distinct entry condition, capability set, reference set,
transition rule, resume boundary, or terminal responsibility. If two adjacent
phases always load the same inputs, use the same capabilities, and transition
unconditionally, merge them.

## 3. Vocabulary

Use these terms consistently:

- **Durable state**: externally meaningful state that must survive a process,
  session, or context restart. Examples include an issue label, PR state,
  event-log state, committed artifact, or immutable workflow record.
- **Lane**: a top-level category of work with its own routing priority, such as
  task review, active task, queue claim, finalization, or learning proposal.
- **Phase**: an internal runtime step with one purpose and one bounded contract.
  A phase may be recomputed and normally does not need its own durable label.
- **Action**: the machine-readable instruction returned to the caller, such as
  `continue`, `current-session-required`, `spawn-parallel-workers`, `blocked`,
  `idle`, or `completed`.
- **Transition**: the validated movement from one durable state or runtime phase
  to another in response to an event or completed phase result.
- **Effect**: an authorized mutation of GitHub, files, git refs, event logs, or
  another external system.
- **Checkpoint**: a stable workflow boundary whose identity can be validated
  before resuming.
- **Resume token**: a machine-readable, immutable binding to the paused phase,
  next phase, source version, entity identity, and observed snapshot.
- **Adapter**: a domain-specific implementation behind one stable interface.

Do not use `state`, `phase`, and `action` as synonyms. Confusing them produces
unnecessary durable labels, ambiguous resume behavior, and duplicated routing.

## 4. Design sequence

Design a phased skill in this order:

1. Identify the canonical state and evidence source.
2. Enumerate top-level lanes and define their deterministic priority.
3. Separate durable states from internal phases and returned actions.
4. Draw the legal graph, including retry, failure, compensation, and terminal
   edges.
5. Define one contract for every phase.
6. Assign every decision, mutation, reference, schema, and adapter to one owner.
7. Define the Determinism Boundary and the exact Codex judgment surface.
8. Define the lazy reference and module load plan.
9. Define immutable identity for handoff, resume, retry, cache, and stale checks.
10. Define effect capabilities, preconditions, postconditions, and compensation.
11. Define canonical result envelopes and failure codes.
12. Write transition, router, resume, idempotency, and lazy-load tests.
13. Measure initial context and the largest active phase when context cost is
    material.
14. Implement or migrate one vertical lane at a time.

Do not begin with a directory tree or a list of modules. The graph and ownership
contract determine the files, not the reverse.

## 5. Canonical workflow model

A normal large skill uses this conceptual flow:

```text
COMMAND_ROUTE
      |
      v
MINIMAL_BOOTSTRAP
      |
      v
SNAPSHOT_BOUNDARY
      |
      v
LANE_ROUTER
      |
      +--> LANE_A phases
      +--> LANE_B phases
      +--> LANE_C phases
      +--> IDLE / BLOCKED
```

The exact names are domain-specific. Keep the responsibilities stable:

- `COMMAND_ROUTE` parses caller intent without loading unrelated domain code.
- `MINIMAL_BOOTSTRAP` resolves only the repository, configuration, and global
  invariants needed by all commands.
- `SNAPSHOT_BOUNDARY` freezes the authoritative input version for one routing
  cycle when concurrent external state can change.
- `LANE_ROUTER` selects one lane from ordered summary data.
- Lane phases hydrate only the selected entity, run the required decision, and
  execute only the allowed effects.

A simple command may exit after `COMMAND_ROUTE` or `MINIMAL_BOOTSTRAP`; it must
not traverse the full autonomous workflow merely because the executable shares
an entrypoint.

## 6. Durable states versus runtime phases

Durable state exists only when another process, user, or future session must
observe it. Runtime phases exist to bound one execution path.

Use durable state for:

- externally visible lifecycle status;
- immutable evidence that must survive interruption;
- a claimed ownership or concurrency lock;
- a published review or completion boundary;
- a checkpoint that cannot be safely recomputed.

Use runtime phases for:

- command parsing;
- summary scans and selected detail hydration;
- validation and classification;
- rendering and publication preflight;
- handoff preparation;
- readback and postcondition checks;
- cleanup and return-to-base behavior.

Do not create a GitHub label, committed file, or event for every internal phase.
Persist only the minimum durable facts required to resume or audit correctly.
Derive projections and summaries from the canonical source instead of writing
parallel ledgers.

## 7. Lane routing

A lane router is a deterministic selector, not an executor.

The router must:

- use an explicit, documented priority order;
- inspect summary records first;
- stop after selecting one authoritative candidate;
- return the selected lane, phase, entity identity, and next action;
- avoid loading lane-specific references or modules before selection;
- perform no mutation;
- use stable tie-breakers for equally eligible candidates;
- fail closed when global invariants are violated.

Example result:

```json
{
  "schema_version": 1,
  "lane": "task-review",
  "phase": "REVIEW_HYDRATE",
  "action": "continue",
  "entity": {
    "kind": "pull_request",
    "number": 482
  }
}
```

Broad scans should fetch only fields needed to route, such as identity, state,
labels, priority, timestamps, and branch refs. Fetch bodies, comments, artifacts,
or logs only after one item is selected.

## 8. Phase contract

Every phase must have one explicit contract. Document it in the routed workflow
reference and implement the deterministic parts in code.

Use these fields:

| Field | Requirement |
|---|---|
| `phase` | Stable phase identifier. |
| `lane` | Owning lane. |
| `purpose` | One reason the phase exists. |
| `entry_when` | Exact predecessor result or state predicate. |
| `inputs` | Minimum immutable or validated data required. |
| `preconditions` | Facts that must hold before decisions or effects. |
| `required_refs` | Exact references to load for this phase. |
| `handler` | Script module or named-skill handoff that owns execution. |
| `capabilities` | Allowed read, write, process, worker, or network abilities. |
| `effects` | Authorized mutations, or `none`. |
| `result` | Canonical machine-readable output schema. |
| `successors` | Complete allowlist of legal next phases or terminal actions. |
| `retry_identity` | Idempotency key or explicit retry authorization. |
| `compensation` | Required reversal when a partial effect fails. |
| `terminal` | Whether the result ends the lane or workflow. |

A phase without a distinct contract is not a phase. A phase contract must be
small enough that its handler can be tested without executing unrelated lanes.

Example definition:

```json
{
  "phase": "CLAIM_LOCKED_TRANSACTION",
  "lane": "queue-claim",
  "purpose": "Claim exactly one selected task under the repository lock.",
  "entry_when": "CLAIM_PREFLIGHT returned eligible",
  "required_refs": [
    "references/queue/claim-transaction.md"
  ],
  "capabilities": [
    "github:issue-read",
    "github:issue-write",
    "repo-lock",
    "git:branch-write"
  ],
  "effects": [
    "replace_issue_state",
    "write_claim_comment",
    "prepare_branch"
  ],
  "successors": [
    "HANDOFF_PLAN",
    "CLAIM_COMPENSATE",
    "BLOCKED"
  ],
  "terminal": false
}
```

Do not create a parallel machine-readable phase registry solely for architecture
validation or documentation. If an active runtime or measurement tool genuinely
consumes a registry, make that registry authoritative or generate it from the
authoritative runtime graph. Otherwise keep the graph in the owning workflow
module and the routed reference.

## 9. Transition ownership

The transition function is script-owned whenever stable inputs and rules can
produce a stable result.

Prefer a pure decision boundary:

```text
transition(current_state, event, snapshot)
  -> { next_state, next_phase, action, effects, failure_code }
```

The transition owner must:

- validate the current state and event schema;
- use an explicit allowlist of legal edges;
- reject missing, stale, duplicate, or contradictory evidence;
- return stable failure codes and the exact next action;
- order candidates and effects deterministically;
- separate decision from infrastructure mutation;
- expose no prose-only alternate path;
- make terminal states explicit and absorbing unless a documented recovery edge
  exists.

Codex may choose only when genuine domain judgment remains. In that case the
script must return a bounded set of valid options and validate the selected
option before transition.

Never duplicate transitions in the CLI, renderer, reference prose, and mutation
adapter. Prose describes the authoritative implementation; it does not become a
second implementation.

## 10. Canonical result envelope

All phase handlers should return one stable envelope shape. Domain evidence may
be nested, but routing fields remain common.

Recommended shape:

```json
{
  "schema_version": 1,
  "lane": "task-finalization",
  "phase": "PR_READBACK_VALIDATE",
  "action": "continue",
  "next_phase": "ISSUE_FINAL_TRANSITION",
  "status": "ok",
  "entity": {
    "kind": "pull_request",
    "number": 482
  },
  "required_refs": [],
  "observations": {},
  "effects": [],
  "resume_context": null,
  "failure": null
}
```

Recommended terminal actions are a small bounded vocabulary:

```text
continue
idle
blocked
dry-run
current-session-required
spawn-parallel-workers
completed
```

Use domain-specific actions only when they change caller behavior. Do not return
narrative output where the caller needs a routing token.

## 11. Handoff and resume

Use a handoff when execution must continue in the current Codex session, another
named skill, an external worker, a review loop, or a user-controlled step.

The producer must return:

- current lane and phase;
- exact next phase;
- named skill or worker contract;
- required references for the receiver;
- immutable entity identity;
- source or runner version;
- input, state, or result digest;
- observed external snapshot such as PR head OID or review cursor;
- explicit resume arguments or token;
- stop conditions and invalidation rules.

Example resume context:

```json
{
  "schema_version": 1,
  "cycle_id": "cycle-20260718-001",
  "lane": "task-finalization",
  "phase": "PRE_PUSH_REVIEW_HANDOFF",
  "next_phase": "PRE_PUSH_REVIEW_RESUME",
  "source_commit": "20a42a09df155feb4faaa0bbc02fad5ef79145ea",
  "entity_id": "issue:2459",
  "branch": "codex/issue-2459",
  "head_oid": "74480860d...",
  "result_digest": "sha256:...",
  "snapshot": {
    "pull_request": 3671,
    "review_cursor": "..."
  }
}
```

Resume must re-read the authoritative state and validate every identity field
that protects correctness. If the source, branch, head, result, event-log head,
review cursor, or selected entity changed incompatibly, return an exact stale
failure and re-enter the appropriate hydration or review phase. Never silently
resume from memory or reconstruct a paused finalization from a fresh broad scan.

Do not persist custom resume files when an existing canonical event log, PR body,
issue comment, branch, or caller-held token already provides the required durable
surface.

## 12. Lazy instruction loading

`SKILL.md` is the phase router and only mandatory skill-local initial file.
Detailed references are loaded after the current command, lane, and phase are
known.

Rules:

- List exact phase references under the phase router or return them as
  `required_refs`.
- Load only the current phase's references.
- Do not read all references to avoid missing a future rule.
- Put global invariants in `SKILL.md`; put phase-specific detail in one focused
  reference owned by that phase or domain.
- Link to canonical shared-domain references instead of copying them.
- Do not split one concern into many tiny references solely to lower per-file
  size; optimize the active context, not the file count.
- Do not combine unrelated phases in one large reference merely because they
  belong to the same skill.
- Load named-skill instructions at the handoff boundary, not during broad routing.
- Re-read only when source identity changed or the owning contract requires a
  fresh snapshot.

A phase router should make the allowed instruction set obvious:

```text
BASELINED:
  workflow.md
  shared/kpi-gates.md

DIAGNOSTIC:
  safety-and-edit-surface.md
  log-first-rules.md

FINALIZED:
  finalization.md
  shared/pr-artifact.md
```

The caller must not infer additional references from old transcripts, examples,
or neighboring phases.

## 13. Context measurement

For materially large workflows, measure:

- initial mandatory file count, lines, bytes, and estimated tokens;
- each phase's reference count, lines, bytes, and estimated tokens;
- the largest phase-lazy context;
- the combined router plus largest phase context;
- duplicated rules or documents removed;
- orchestration steps removed by deterministic commands;
- mutable evidence sources before and after.

A context manifest is optional and justified only when a script consumes it or a
regression check protects a material optimization. It should record the baseline
identity, measurement method, mandatory initial set, and exact phase sets. Do not
create an unvalidated manifest that can drift from the phase router.

Context optimization must not hide required safety rules. Move the rule to the
phase that can exercise the relevant capability, and test that the phase loads
it before that capability is used.

## 14. Lazy script and module loading

Instruction lazy loading and runtime module lazy loading are separate concerns.
A file imported by Node.js does not automatically enter the model context, but it
still increases startup work, coupling, side effects, and the reachable module
graph.

Use this dependency direction:

```text
thin entrypoint
  -> command router
    -> phase application service
      -> pure domain transition modules
      -> narrow infrastructure adapters
      -> lazy domain-kind adapter
```

Rules:

- Keep CLI parsing, result printing, and exit codes in the entrypoint.
- Route the command before importing command-specific modules.
- Route the phase before importing phase handlers and domain-kind adapters.
- Keep summary-read gateways separate from selected-detail gateways.
- Keep read adapters separate from write adapters when dry-run or inspection
  commands must not reach mutation code.
- Put stable domain decisions in pure modules with injected data or adapters.
- Load domain-kind adapters by a stable kind only after the selected entity is
  hydrated.
- Do not let a generic core import every current and future adapter.
- Do not use lazy `require()` to conceal circular dependencies.
- Do not build a plugin system or registry unless an active runtime or
  measurement tool consumes it.

Representative lazy-load tests should inspect the module cache or import trace.
For example, `help` should not load GitHub, publication, learning, or domain
adapters; a generic finalization should not load listening-episode validators.

## 15. Capability and effect boundaries

Every phase has an allowlist of capabilities. Examples:

```text
github:issue-read
github:issue-write
github:pr-read
github:pr-write
git:read
git:branch-write
git:push
repo-lock
worktree:create
process:worker
host-handoff
```

A phase must not call an undeclared capability. Keep reads and decisions separate
from mutation where practical.

Prefer a deterministic effect plan:

```json
{
  "observations": {},
  "decision": "CLAIM",
  "effects": [
    {
      "type": "replace_issue_state",
      "issue": 2459,
      "from": "in-queue",
      "to": "in-progress"
    },
    {
      "type": "write_claim_comment",
      "issue": 2459
    }
  ],
  "postconditions": [
    "exactly_one_active_issue",
    "selected_issue_is_in_progress"
  ]
}
```

The effect executor owns infrastructure calls, stable ordering, postcondition
checks, and compensation. A dry-run returns the plan and must not import or call
write adapters.

When several writes must be atomic relative to other runners, keep authoritative
revalidation, effects, compensation, and lock release inside one critical
section. Do not split a claim or reservation transaction into independently
retryable prose steps.

## 16. Idempotency, retry, and concurrency

Every repeatable phase must answer:

- What identifies the operation?
- How is a duplicate detected?
- Is a duplicate a no-op, a cache hit, a conflict, or an explicit retry?
- Which input or state hash must still match?
- Which partial effects require compensation?
- Which lock or compare-and-swap protects concurrent writers?

Use immutable identifiers such as:

- event IDs and event-log head hashes;
- issue or PR numbers plus head OID;
- source and configuration hashes;
- candidate fingerprints;
- result digests;
- globally reserved test or attempt IDs;
- review cursors and handled comment IDs.

Retries must be idempotent or explicitly authorized by a token bound to the
failed operation. Never allocate a new identity merely because the caller cannot
explain the old result.

## 17. Mutation safety and compensation

Before mutation, validate:

- current durable state;
- selected entity identity;
- source and branch identity;
- authorization and capability;
- required evidence freshness;
- absence of conflicting active work;
- exact effect plan.

After mutation, re-read or otherwise verify the postconditions.

If a multi-step mutation partially succeeds, either:

- complete the transaction safely;
- execute the documented compensation;
- persist enough canonical evidence for deterministic recovery;
- or stop with a blocker that names the completed and incomplete effects.

Do not mark a valid completed task blocked solely because local cleanup failed.
Separate domain completion from local recovery state when their external meaning
differs.

## 18. Domain adapters and extension

Use an adapter when several skill kinds share a generic lifecycle but require
different evidence, validation, rendering, or finalization rules.

The core owns:

- command and lane routing;
- generic result envelope;
- durable lifecycle invariants;
- effect execution;
- generic publication and readback sequencing.

The kind adapter owns:

- domain evidence schema;
- domain validation;
- domain blocker rules;
- deterministic projection into generic artifacts;
- kind-specific finalization gates.

Load only the selected kind adapter. Extend by adding a cohesive adapter behind
the existing interface, not by growing a central `if kind === ...` dump.

Do not place generic lifecycle rules in a domain adapter or domain evidence rules
in the core.

## 19. Canonical evidence and observability

Use one authoritative state/evidence source when the workflow requires durable
history. Examples include an append-only event log, GitHub issue/PR state, or a
committed machine-readable artifact.

Derived outputs may include:

- status summaries;
- checkpoint rows;
- reports;
- PR bodies;
- telemetry;
- context measurements;
- final result envelopes.

These are projections, not additional mutable sources of truth.

Record only facts needed to audit or resume. Do not persist every runtime phase
entry merely for tracing. When telemetry is useful, it may observe phase events
but must not decide transitions.

## 20. Testing contract

A phased workflow needs focused tests for all of these that apply:

### Graph and transitions

- every legal transition;
- every illegal transition;
- terminal state absorption;
- deterministic ordering and tie-breakers;
- repeated phases and bounded loops;
- exact failure codes and next actions.

### Router and hydration

- lane priority;
- summary scan before detail fetch;
- only one selected item hydrated;
- no lower-priority lane fetched after a decisive match;
- violated global invariant fails closed.

### Resume and identity

- valid resume on unchanged identity;
- stale source, branch, head, cursor, event-log head, or result digest;
- duplicate handoff acknowledgment;
- fresh invocation cannot impersonate paused execution.

### Effects

- dry-run performs no write;
- capability violation fails;
- precondition failure performs no partial write;
- postcondition failure is surfaced;
- compensation after each injected partial failure;
- lock release on success and failure;
- concurrent claim or reservation attempts.

### Lazy loading

- initial instruction set contains only `SKILL.md` and global instructions;
- each representative phase loads exactly its routed references;
- unrelated references are not loaded;
- help, list, inspect, and dry-run do not load write or domain modules;
- generic kinds do not load unrelated adapters;
- no lazy import hides a dependency cycle.

### Context and evidence

- context metrics are reproducible when claimed;
- phase manifest or measurement source matches the router when one exists;
- derived evidence is stable and does not become a second mutable source;
- renderer consumes decisions and does not recompute them.

Use characterization tests before moving legacy behavior. Use fault injection for
transactions, compensation, stale snapshots, and lock release.

## 21. Legacy migration sequence

Refactor a large skill by strangling the monolith rather than rewriting it at
once.

1. Capture command outputs, state transitions, effects, failure paths, loaded
   modules, and loaded references with golden or characterization tests.
2. Introduce the lane, phase, action, and result-envelope vocabulary while the
   legacy implementation remains behind one handler.
3. Split multi-purpose references and make `SKILL.md` the minimal router.
4. Extract a thin command router and dynamic phase loader.
5. Separate summary reads from selected detail hydration.
6. Extract read-only lanes before mutation lanes.
7. Extract the most concurrency-sensitive transaction with fault-injection tests.
8. Extract generic finalization and lazy domain adapters.
9. Extract handoff/resume and stale-snapshot validation.
10. Extract learning, maintenance, or auxiliary lanes after the primary lifecycle
    is stable.
11. Add capability/effect enforcement and lazy-load regression tests.
12. Compare the phased engine against golden behavior behind a temporary cutover
    switch.
13. Make the phased engine default and remove the legacy path, duplicate rules,
    forwarding exports, and compatibility references.

Each migration step must leave one coherent, tested runtime. Do not split files
without transferring complete responsibility and tests.

## 22. Recommended phased skill shape

Use only the files the workflow needs:

```text
.agents/skills/<skill>/
  SKILL.md                         minimal router and invariants
  references/
    workflow.md                    authoritative graph and phase contracts
    <phase-or-domain>.md           details loaded only by routed phases
  scripts/
    command.js                     thin CLI entrypoint
    lib/
      command-router.js            command to initial phase
      lane-router.js               ordered lane selection
      state-machine.js             transitions and next_action
      result-envelope.js           stable machine-readable output
      capability-gate.js           phase capability enforcement
      effect-executor.js           mutations and postconditions
      resume.js                    checkpoint identity validation
    lanes/
      <lane>/                      lane application services
    adapters/
      <kind>/                      lazy domain-specific behavior
    tests/
      <focused tests>
  schemas/
    result.schema.json
    resume.schema.json
```

This is a vocabulary template, not a requirement to create every directory.
Keep one-skill behavior inside the skill. Move genuinely reused behavior to a
shared domain only after real reuse exists.

## 23. Minimal `SKILL.md` pattern

A phased skill's initial file should normally contain:

```text
Frontmatter
Purpose and scope
Only-mandatory-initial-file statement
Global invariants
Required input and authorization
Canonical command or facade
State machine summary
Phase router with exact required references
Result/action vocabulary
Stop conditions
Determinism Boundary
```

Do not put every phase algorithm, schema field, example, migration note, or
historical exception into `SKILL.md`. Route those details to the owning phase
reference or script.

## 24. Anti-patterns

Reject:

- one giant `SKILL.md` that eagerly embeds every lane and exception;
- reading every reference before the current phase is known;
- top-level imports of all commands, lanes, and domain adapters;
- a prose state machine that Codex manually reproduces;
- duplicated transitions in CLI, renderer, and references;
- a durable label or file for every runtime phase;
- broad detail hydration before selecting one item;
- a fresh invocation reconstructing a paused finalization from guesses;
- retry without immutable operation identity;
- mutation before authoritative revalidation;
- a dry-run path that reaches write adapters;
- custom ledgers duplicating an existing event log or GitHub source of truth;
- a central conditional dump for every skill kind;
- a manifest or plugin framework that has no runtime or measurement consumer;
- lazy imports used to hide circular dependencies;
- context optimization that omits a safety rule before the relevant capability;
- a phase whose only purpose is forwarding to the next phase.

## 25. Review checklist

Before approving a phased skill, verify:

- Is the simple-versus-phased classification justified?
- Can the durable states, lanes, phases, actions, and effects be named without
  ambiguity?
- Is lane priority deterministic?
- Does every phase have one purpose and a complete contract?
- Does one script own transitions and `next_action`?
- Is Codex judgment bounded to validated options?
- Is `SKILL.md` the only mandatory initial skill-local file?
- Are references and modules loaded only after routing?
- Are summary scans separated from selected hydration?
- Are handoffs bound to immutable identity and stale-checked on resume?
- Are mutations capability-gated, postcondition-checked, and compensated?
- Are retries idempotent or explicitly authorized?
- Is there one canonical durable state/evidence source?
- Are domain adapters lazy and behind one stable interface?
- Can domain decisions be tested without GitHub, filesystem, network, or child
  processes?
- Do tests prove illegal transitions and absence of unrelated loads?
- Are context measurements reproducible when optimization is claimed?
- Can a new lane or adapter be added without changing unrelated core behavior?
- Is the implementation smaller and more explicit than the workflow it replaces?

## 26. Completion evidence

For a new or refactored phased skill, report:

- why phases are required;
- durable state, lane, phase, action, and effect vocabulary;
- the complete legal graph and terminal paths;
- each phase contract and owner;
- the Determinism Boundary;
- lazy reference and module matrix;
- initial and largest-phase context metrics when material;
- resume identity and stale rules;
- capability, effect, idempotency, lock, and compensation rules;
- adapter boundaries;
- focused transition, router, resume, effect, lazy-load, and context tests;
- exact validation commands and results;
- any remaining bounded Codex-owned judgment.
