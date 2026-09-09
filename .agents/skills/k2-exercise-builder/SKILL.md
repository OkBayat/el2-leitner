---
name: k2-exercise-builder
description: Build or revise a runtime-ready Vocora exercise as one app-slides-sequence-exercise configuration made only from registered reusable slides. Use whenever a caller asks to design, author, configure, or materially revise an individual exercise or its slide sequence; use after lesson-level planning when exact exercise objects are required.
---

# K2 Exercise Builder

Build one runtime-ready `slides.sequence` exercise for `app-slides-sequence-exercise`. Never create an exercise-specific component or invent a slide type. Compose the smallest sequence of registered slide types that directly measures or supports the stated objective.

## Workflow classification

This is a simple, linear, stateless, non-resumable authoring workflow. It creates no durable workflow state.

## Scope

This skill owns the exact runtime exercise envelope, slide selection, slide ordering, configured slide data, terminal flow, and deterministic validation of an individual exercise. Lesson-wide target inventory, prerequisite graphs, source coverage, and cross-exercise sequencing remain owned by `k2-lesson-exercise-design`; when that workflow needs runtime-ready exercises, it must hand each exercise to this skill.

It does not own Angular component implementation, backend persistence, lesson-level pedagogy, source retrieval, audio generation, migrations, deployment, or creating new slide families.

## Invariants

1. Use `type: "slides.sequence"`, `schemaVersion: 1`, and `completionPolicy: "slide-sequence"` so the existing `app-slides-sequence-exercise` runtime owns navigation and outcome evidence.
2. Use only registered slide types from [slide-catalog.md](references/slide-catalog.md). Never generate a feature-specific component or unregistered type.
3. If no registered slide expresses the required learner action or evidence, stop and identify the missing capability. Do not approximate it with a semantically different slide.
4. Treat `selection` as an unscored learner decision and `choice` as a scored answer. Never put correctness fields on `selection`.
5. Keep all learner-facing behavior in the slide object. The component must not contain exercise-specific copy, options, answers, or branching assumptions.
6. Use unique stable slide IDs and exactly one terminal final `summary` slide.
7. Use explicit answer keys only for scored slides. Submitted-response slides record evidence but do not imply semantic mastery without an evaluator.
8. Preserve source wording and answer constraints. Do not invent facts, answer keys, audio URLs, or unsupported accepted answers.
9. Prefer the fewest slides that achieve the objective. Do not add interaction variety for its own sake.
10. For runtime-sized paths, a `selection` may declare `expansionId`; the application parent must own a matching runtime handler that returns only registered, non-terminal slide objects. Keep functions and services out of the exercise JSON.

## Workflow

### 1. Establish the exercise contract

Identify the primary objective, source material, learner action, required evidence, prerequisites already satisfied, and completion behavior. If any answer-bearing source is missing, stop instead of guessing.

### 2. Select existing slides

Read [slide-catalog.md](references/slide-catalog.md). Map every step to an existing slide by learner action and evidence type. Use presentation slides only where preparation is necessary; use scored or submitted slides for evidence.

If no catalog entry fits, return a blocked result containing the objective, missing interaction capability, and why the closest existing slides are semantically wrong. Do not edit the registry or create a component under this skill.

### 3. Author the runtime object

Read [exercise-contract.md](references/exercise-contract.md). Author one JSON object using the application contract's camelCase names. Put configuration in `config.slides[].data`; use `chrome` only to override shared shell behavior intentionally.

For each slide, verify that its prompt, stimulus, options, answer key, response constraints, and feedback semantics support the same objective. End with the terminal summary. A finish-only summary may use empty display fields and hide its header.

When a selection determines a runtime-sized path, follow the dynamic expansion contract in [exercise-contract.md](references/exercise-contract.md). Use it only when the application already supplies the named handler and authoritative runtime source. The authored JSON names the capability with `expansionId`; it never embeds a callback, service, or generated slide list.

### 4. Validate and return

Write the candidate object to a temporary JSON file and run:

```bash
rtk python3 .agents/skills/k2-exercise-builder/scripts/validate-exercise.py \
  --input <exercise.json>
```

Fix all failures at the object source. Return the validated exercise object and, only when useful, a short note explaining slide selection or a blocker.

## Stop conditions

Stop without inventing configuration when:

- the objective or source boundary cannot be identified;
- a scored answer cannot be grounded in the supplied source;
- required text, audio, image, chart, or diagram evidence is unavailable;
- no registered slide type supports the required learner action or evidence;
- the requested behavior requires branching, evaluation, persistence, or media handling not supported by either the static runtime contract or a registered selection expansion handler;
- a configured `expansionId` has no application-owned handler or authoritative runtime source;
- deterministic validation cannot run or rejects the exercise.

## Validation

Run from the repository root after changing this skill:

```bash
rtk python3 .agents/skills/k2-exercise-builder/scripts/test-validate-exercise.py
rtk python3 .agents/skills/k2-exercise-builder/scripts/test-validate-skill.py
rtk python3 .agents/skills/k2-exercise-builder/scripts/validate-skill.py
```

Also run the repository-required `k2-skill-architecture` validator.

## Determinism Boundary

### Script-owned

- Validate the `slides.sequence` envelope, supported slide allowlist, unique IDs, and terminal-final invariant.
- Validate required per-type fields and basic referential integrity.
- Reject correctness fields on unscored `selection` slides.
- Validate this skill's files, routing, references, interface metadata, and focused tests.

### Agent-owned

- Interpret the objective and source material.
- Select the smallest semantically correct combination of existing slides.
- Author prompts, stimuli, distractors, accepted answers, feedback, and constraints.
- Judge whether an existing slide genuinely supports the required evidence.
- Verify that a dynamic selection expansion is registered by the owning application surface and can cover its complete runtime source without invented content.
- Explain a blocked capability without inventing a workaround.

### Codex-owned

- Codex performs the semantic responsibilities listed under `Agent-owned` and reports the validated object or explicit stop condition.
- Codex must not replace script-owned validation with manual inspection.

### No manual fallback

- Do not return an exercise that fails `validate-exercise.py` and call it valid by inspection.
- Do not bypass a missing registered slide with a feature-specific component or ad hoc type.
- Do not guess answer-bearing content, asset locations, or evaluator behavior.
- Fix the validator when its deterministic contract is wrong; do not replace it with a prose checklist.
