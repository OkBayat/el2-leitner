# K2 Skill Architecture Rules

Read this only for non-trivial ownership, determinism, or refactoring decisions.

## Placement decision

| Question | Placement |
| --- | --- |
| Used by only one skill? | Keep it inside that skill. |
| Used by two or more skills for the same domain reason? | Move it to `shared/<domain>/`. |
| Project-level configuration? | Keep it under `.agents/config/`. |
| Repository-wide development guidance? | Keep it in `docs/` or the authoritative `AGENTS.md`. |
| Another skill must run next? | Use a named skill handoff; do not import its private files. |

Do not move a file to shared only because it looks generic. Reuse must be real,
not speculative.

## Standard skill shape

Use only the directories the skill needs:

```text
.agents/skills/<skill>/
  SKILL.md
  agents/openai.yaml
  references/
  contracts/
  scripts/
    lib/
    tests/
  schemas/
  assets/
```

`SKILL.md` owns routing and workflow. References own detailed guidance. Contracts
own machine-readable interfaces only when an active runtime, integration, or tool
consumes them. Scripts own deterministic behavior. Schemas own reusable data
formats. Assets are non-instruction resources.

## Large workflow architecture

A skill with multiple lifecycle stages, conditional lanes, durable state,
retries, rollback, external handoffs, resume behavior, or material context cost
uses [phased-workflow-architecture.md](phased-workflow-architecture.md).

Keep this contract inside `k2-skill-architecture`; do not create a second generic
workflow-architecture skill or duplicate the rules in OKF. A phased workflow must
separate durable state, runtime phase, action, and effect; route before loading;
make transitions and `next_action` script-owned; and bind handoff/resume to
immutable identity.

Keep phase truth in the owning runtime/router and routed references. Do not add a
parallel workflow manifest solely so architecture tooling can validate a second
representation of the same graph.

Do not phase a small linear skill. Do not add a registry, manifest, or plugin
system unless a concrete runtime or measurement requirement consumes it.

## Shared domain shape

New shared assets use a domain boundary:

```text
.agents/skills/shared/<domain>/
  references/
  scripts/
  tests/
  schemas/
```

A shared domain should have one vocabulary and one reason to change. Reject
names such as `common`, `misc`, `utils`, or `helpers` as top-level domains.

Do not migrate untouched legacy shared files merely to satisfy the preferred
shape. Move them only when an active change requires clearer ownership.

## DDD rules

- Name boundaries from Vocora domain language, not file types.
- Keep one domain concept under one owner.
- Keep workflow coordination in the skill and domain rules in callable modules.
- Keep lane routing, transitions, effects, and adapters in distinct ownership
  boundaries when the workflow is phased.
- Do not let infrastructure details redefine domain decisions.
- Shared domains must represent stable capabilities, not convenience folders.

## SOLID rules

- Single responsibility: each script module has one reason to change.
- Open/closed: extend through a new cohesive rule or adapter, not growing a
  central conditional dump.
- Substitution: adapters must honor one explicit result contract.
- Interface segregation: expose workflow capabilities, not internal helpers.
- Dependency inversion: domain rules receive data or adapters; they do not own
  GitHub, filesystem, or process setup.

Use `k2-skill-script-architecture` for executable line, export, facade, and cycle
limits.

## TDD rules

1. Define the observable result and failure codes.
2. Write a focused failing test.
3. Implement the smallest passing behavior.
4. Refactor only inside the tested boundary.
5. Run focused tests, syntax checks, and architecture validators.

Before changing legacy deterministic behavior, add a characterization test that
captures the contract being preserved.

For phased workflows, include transition-table, illegal-edge, router-priority,
stale-resume, idempotency, compensation, capability, and lazy-load tests where
those behaviors exist.

## Determinism decision

Use this order:

1. Can stable inputs and rules produce the same output every time?
2. Can the result be represented as canonical JSON or an exact file mutation?
3. Can failure be expressed with an exact code and next action?

If yes, the operation is script-owned.

Typical script-owned operations:

- validation and schema checks;
- parsing and aggregation;
- state machines, phase selection, and lifecycle transitions;
- command and path generation;
- deterministic selection from fully ordered inputs;
- resume and stale-snapshot validation;
- capability and effect planning;
- evidence rendering;
- mutation, rollback, cleanup, compensation, and finalization.

Typical Codex-owned operations:

- interpreting user intent;
- domain-semantic review;
- explaining tradeoffs;
- selecting among a bounded set when the choice requires genuine judgment.

For mixed decisions, scripts must constrain and validate the available options;
Codex may choose only among those valid options and must record the reason.

## Anti-patterns

Reject:

- a prose state machine that Codex must reproduce manually;
- manual calculation or evidence construction when a script can own it;
- two scripts mutating the same state through different contracts;
- a script that returns narrative text when callers need structured data;
- direct access to another skill's private implementation;
- duplicated canonical rules in several `SKILL.md` files;
- one large shared folder organized only by file type;
- speculative abstractions, manifests, registries, or plugin systems;
- tests that require full CLI execution for pure domain rules;
- eager reference or module loading before the current command and phase are
  known;
- durable external state created only to mirror an internal runtime phase;
- a fresh invocation resuming a paused workflow without validating identity.

## Review checklist

- Is the skill boundary understandable without reading unrelated skills?
- Is each new file owned by exactly one skill or shared domain?
- Is every repeatable operation script-owned where practical?
- Does the script return canonical machine-readable results?
- Is Codex judgment bounded and explicit?
- Is there exactly one source of truth for each rule and contract?
- Are detailed references and domain modules loaded only when needed?
- When phased, are durable state, phase, action, transition, resume, and effect
  boundaries explicit?
- Can domain behavior be tested without infrastructure?
- Did tests precede new deterministic behavior?
- Is the implementation smaller than the problem, not larger?
