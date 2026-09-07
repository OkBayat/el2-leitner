---
name: k2-principles
description: Use this skill only when the user explicitly invokes k2-principles to select the smallest relevant set of engineering principles for the current task.
---

# K2 Principles

This skill is explicit-invocation only. Use it only when the user directly asks
to run or apply `k2-principles`; do not infer or auto-select it from the task
type, changed files, or mutation intent.

Its only job is to remind the agent which engineering principles apply. The
task's primary skill or workflow remains the execution owner.

## Explicit-invocation workflow

1. Read the accepted task intent and planned change surfaces.
2. Select the smallest applicable principle set from the table below.
3. Always include `karpathy_guidelines`.
4. Read each selected reference completely and no unselected principle
   reference.
5. State the selected principles and one short reason for each.
6. Return control to the primary workflow and do not run a completion check.

Selection is guidance, not an approval, risk, evidence, review, or publication
gate. This skill does not inspect repository state, validate implementation,
classify critical paths, request human approval, or own any later task phase.

## Lazy-load routing

| Principle | Select when | Reference |
| --- | --- | --- |
| `karpathy_guidelines` | Any explicitly-invoked mutation task | `references/principles/karpathy-guidelines.md` |
| `solid` | A responsibility, module, interface, dependency, or ownership boundary changes | `references/principles/solid.md` |
| `tdd` | Fixing a bug, changing observable behavior, or refactoring behavior-sensitive code | `references/principles/tdd.md` |
| `ddd` | Changing learning, vocabulary, listening, exercise, learner-progress, study-planning, or other domain rules | `references/principles/ddd.md` |
| `cqrs` | Changing a real command/query, read/write-model, or projection boundary | `references/principles/cqrs.md` |
| `security` | Changing authentication, authorization, secrets, untrusted input, learner data, privileged operations, or external-service access | `references/principles/security.md` |
| `data_integrity` | Changing persistence, migrations, transactions, reconciliation, or authoritative state | `references/principles/data-integrity.md` |
| `contracts` | Changing APIs, schemas, events, webhooks, provider adapters, or agent-facing contracts | `references/principles/contracts.md` |
| `reliability` | Changing workers, queues, retries, cron, shutdown, recovery, observability, or deployment configuration | `references/principles/reliability.md` |

Use semantic task intent as the primary signal and planned paths only as
supporting context. Do not select DDD, CQRS, or another principle merely because
a nearby filename contains a suggestive word.

If no conditional principle applies, load only `karpathy_guidelines`. Specific
Vocora repository instructions and domain skills remain authoritative and may
impose requirements beyond these reminders.

## Selection handoff

Use a compact handoff such as:

```text
Selected principles:
- karpathy_guidelines — baseline simplicity and surgical-change discipline
- tdd — the task changes observable behavior

References read:
- references/principles/karpathy-guidelines.md
- references/principles/tdd.md
```

Do not create a JSON contract, receipt, digest, evidence object, persisted
selection, compatibility name, or alternate vocabulary for this handoff.

## Stop conditions

Stop before editing only when the accepted task intent is too ambiguous to
select a bounded principle set safely. Resolve that task ambiguity through the
primary workflow; do not expand this skill into an analysis or validation phase.

## Determinism Boundary

### Script-owned

- None. This skill has no executable selector, validator, state, or evidence
  contract.

### Agent-owned

- Interpret the accepted task intent and planned surfaces.
- Select the smallest applicable set from the canonical table.
- Read only the selected references and state the reasons.
- Apply those reminders while the primary workflow performs the task.

### No manual fallback

- Do not invent principle names or alternate reference paths.
- Do not eagerly load unselected principle references.
- Do not turn selection into a post-implementation check or approval gate.
