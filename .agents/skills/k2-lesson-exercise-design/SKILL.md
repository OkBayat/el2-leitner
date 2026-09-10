---
name: k2-lesson-exercise-design
description: Design a source-grounded, evidence-backed Vocora vocabulary-led lesson learning path as one canonical lesson object whose exercises contain ordered slide arrays. Use when vocabulary-led lesson content is supplied and an agent must derive prerequisites, sequence exercises, author slide-level plans, and validate full source coverage.
---

# K2 Lesson Exercise Design

Use this skill when the caller identifies a vocabulary-led language lesson, lesson section, or lesson content and wants a complete Vocora learning-path design rather than a single isolated question or UI implementation. Route lessons without an identifiable vocabulary scope elsewhere; the fixed opening contract in this skill is intentionally vocabulary-specific.

The default deliverable is one canonical JSON object with lesson metadata, an ordered `exercises` array, and a `slides` array inside every exercise.

## Workflow classification

This is a simple, linear, stateless, non-resumable authoring workflow. The ordered checkpoints below are not durable workflow phases and do not create repository state.

## Scope

This skill owns:

- lesson-content decomposition into explicit learning targets;
- prerequisite-aware exercise sequencing;
- the fixed vocabulary-intake and spelling/dictation opening exercises;
- selection and mixing of reusable slide interaction types for each exercise objective;
- evidence and source-alignment rationale for every exercise and prerequisite edge;
- lesson coverage auditing;
- the canonical lesson-plan JSON envelope;
- deterministic structural validation of that envelope.

This skill does not own:

- Angular component implementation;
- backend exercise runtimes or persistence;
- the canonical runtime schema of individual slide components;
- Leitner scheduling algorithms;
- audio generation, licensing, or source retrieval;
- application migrations or deployment.

When the task also asks to implement application behavior, return the completed lesson design first or keep it as the source artifact, then hand execution to the smallest owning implementation workflow.

## Global invariants

1. **Source truth first.** Derive targets, examples, task requirements, warnings, collocations, grammar/usage rules, reading/listening content, and exam mechanics from the supplied or verified lesson source. Never silently invent missing source facts.
2. **Separate source content from Vocora extensions.** Any exercise content not directly supported by the lesson must be labeled as a `vocora_extension` with a reason.
3. **The first two exercises are fixed.** For this vocabulary-led lesson workflow:
   - exercise 1 is `vocabulary_intake` and introduces all Leitner-eligible lesson vocabulary while activating unseen items into Leitner House 1;
   - exercise 2 is `spelling_dictation` and requires sound-to-form or cue-to-form production for those same Leitner-eligible items.
4. **Do not claim the opening exercises create mastery.** They establish an initial lexical representation and exact form; later exercises deepen contextual, morphological, collocational, aural, receptive, productive, and transfer knowledge.
5. **Everything after exercise 2 is content-dependent.** Do not force a fixed count or fixed list of later exercises. Include an objective only when the lesson contains targets or task demands that justify it.
6. **Prerequisites must be explicit and forward-building.** Every prerequisite must refer to an earlier exercise and state why the earlier capability is needed.
7. **Exercise objective is not slide type.** A collocation, reading, listening, morphology, speaking, or mastery exercise may combine several slide types. Never reduce an exercise to one interaction pattern merely because a component exists.
8. **Use progressive retrieval.** Within and across exercises, normally move from supported recognition to cued recall, then freer recall, integrated comprehension, production, and transfer when the lesson supports those stages.
9. **Prepare before integrated listening.** Teach or retrieve prerequisite vocabulary, collocations, usage, and relevant aural forms before a listening task that depends on them. Treat that ordering as a Vocora prerequisite decision, not a causal claim from correlational research. Add an aural-recognition bridge when the source task depends on recognizing learned forms in speech.
10. **Do not reveal assessment answers while preparing.** Preparation may teach prerequisite language and task mechanics, but must not disclose the answer-bearing information of a later comprehension or exam simulation.
11. **Use real dialogue evidence for dialogue listening.** TTS may support pronunciation, word recognition, or phrase dictation. Do not treat synthetic single-word pronunciation as a substitute for a natural multi-speaker listening passage.
12. **Production follows sufficient input and retrieval.** Speaking and writing should reuse already introduced target language rather than introduce a new lexical burden.
13. **Final mastery is cumulative.** A mastery exercise uses mixed retrieval with reduced support, no new teaching, and coverage of the lesson's important targets. A pass threshold is product policy unless an explicit course contract defines it; do not present an arbitrary threshold as a research fact.
14. **Leitner owns spaced review across sessions.** The lesson path should revisit important targets in varied forms, but it must not duplicate or replace Leitner scheduling.
15. **Every exercise needs evidence.** Include source references, applicable research-principle IDs, and a concrete `sequence_reason`. Do not cite a research paper as proof of the exact complete exercise sequence; the sequence is a Vocora design synthesis built from research principles plus the lesson prerequisite graph.
16. **Coverage must close.** Every source target must be either covered or explicitly listed as uncovered with a blocker or warning. Never silently drop source material.
17. **Agent-facing JSON uses `snake_case`.** Keep one canonical field name for each concept.
18. **Return one object by default.** Unless the caller asks for commentary, return the canonical JSON object rather than prose plus JSON.
19. **Keep rewrite tasks local and predictable.** Follow the local-correction rule and examples in [learning-design-rules.md](references/learning-design-rules.md). Select `rewrite` only for one or two word-level edits, never for full paraphrase or restructuring, and require exact accepted answers in the runtime-ready `k2-exercise-builder` handoff.

## Authoring workflow

### Checkpoint 1 — Audit the lesson source

Read the lesson content or the exact source section the caller identified.

Build a target inventory before designing exercises. Inventory at least the categories that actually occur:

- vocabulary and multiword expressions;
- meanings and semantic contrasts;
- pronunciation or aural forms;
- morphology and word families;
- collocations and formulaic chunks;
- grammar, prepositions, register, and usage warnings;
- reading passages and reading task demands;
- listening passages, audio assets, and listening task demands;
- speaking and writing prompts;
- exam task mechanics, answer constraints, and transfer tasks;
- required assets and missing assets.

Each target receives a stable local ID and source reference. Mark the vocabulary entries that must enter Leitner as `leitner_eligible: true`.

If the source is incomplete, record the gap. Do not fill it from general knowledge unless the caller explicitly asks for research-backed extension; label any such addition as an extension.

### Checkpoint 2 — Build the prerequisite-aware exercise sequence

Read [learning-design-rules.md](references/learning-design-rules.md).

Start with the two fixed exercises, then derive later exercise objectives from the target inventory and lesson task demands.

Create a prerequisite graph, not merely a topic list. Ask for every later objective:

- What must the learner already recognize?
- What must the learner already recall without options?
- What lexical chunks or usage frames appear inside this task?
- Does the task require printed recognition, aural recognition, integrated comprehension, or production?
- Would this exercise introduce a new burden that should be taught earlier?

Prefer the smallest sequence that closes all source targets. Do not add an exercise only to use an available slide type.

### Checkpoint 3 — Author exercises and slide arrays

Read [output-contract.md](references/output-contract.md).

For each exercise:

1. state one primary objective;
2. list source target IDs and any extension IDs;
3. list earlier prerequisites and the reason for each edge;
4. attach source evidence and research-principle IDs;
5. choose slide interactions that fit the objective;
6. vary interactions when variation improves retrieval depth or reduces answer-pattern memorization;
7. order slides from the amount of support appropriate to that exercise toward the intended end performance;
8. define completion evidence without inventing a scientifically privileged score threshold.

The per-slide contract in this lesson-plan artifact is intentionally provisional. Follow the placeholder envelope in `output-contract.md`; when the caller needs exact application configuration, invoke `k2-exercise-builder` for every exercise after the lesson plan is structurally valid. Never invent production component properties in this skill.

### Checkpoint 4 — Audit coverage and validate the object

Before returning the plan:

- verify every source target is in `covered_target_ids` or `uncovered_target_ids`;
- verify every later prerequisite points backward;
- verify every research-principle reference exists in `evidence_catalog`;
- verify the two fixed opening exercises cover all `leitner_eligible` targets;
- verify integrated listening comes after its lexical/aural prerequisites;
- verify final mastery introduces no new teaching target;
- verify all Vocora-only additions are labeled as extensions.

Write the object to a temporary JSON file and run:

```bash
rtk python3 .agents/skills/k2-lesson-exercise-design/scripts/validate-lesson-plan.py \
  --input <lesson-plan.json>
```

Return the object only after the validator reports `status: valid`. If the source itself prevents a production-ready plan, keep the object structurally valid and use `validation.status: blocked` with explicit blockers.

## Slide-contract placeholder policy

The provisional output contract currently allows the 17 reusable interaction types documented in `output-contract.md`, but the `data` payload remains a deliberate placeholder. `k2-exercise-builder` owns the authoritative runtime-ready object and must be used for that handoff.

When the application slide contracts become authoritative for agent generation, update these surfaces atomically:

- `references/output-contract.md`;
- `scripts/validate-lesson-plan.py`;
- focused validator tests;
- any default prompt or routing text that refers to placeholder status.

Do not support both placeholder and final slide-data contracts indefinitely. Replace the placeholder contract in one coherent change.

## Stop conditions

Stop and return a structurally valid blocked plan, or ask for the missing source when no meaningful plan can be produced, if any of these is true:

- the lesson boundary cannot be identified;
- there is not enough source content to identify the lesson's lexical targets;
- the vocabulary-led lesson has no identifiable Leitner-eligible items for the two fixed opening exercises;
- an exercise would require unavailable source audio or text and no explicitly authorized original parallel asset is allowed;
- source materials contradict each other in a way that changes the target inventory;
- a requested exact runtime slide configuration is not available from an authoritative slide contract.

Missing final slide-component configuration is not a reason to invent fields. Use the placeholder slide envelope and mark the plan's production-readiness limitation.

## Validation

Run the focused tests and skill-owned validator from the repository root:

```bash
rtk python3 .agents/skills/k2-lesson-exercise-design/scripts/test-validate-lesson-plan.py
rtk python3 .agents/skills/k2-lesson-exercise-design/scripts/test-validate-skill.py
rtk python3 .agents/skills/k2-lesson-exercise-design/scripts/validate-skill.py
```

For every change to this skill, also run the repository-owned `k2-skill-architecture` validator required by `AGENTS.md`.

## Determinism Boundary

### Script-owned

- Validate the canonical lesson-plan envelope and required field types.
- Validate unique IDs and strictly increasing exercise positions.
- Enforce the fixed first two exercise types and their Leitner-target coverage.
- Validate backward-only prerequisite references.
- Validate research-principle references against the plan's evidence catalog.
- Validate source-target coverage accounting.
- Validate the provisional slide type allowlist and placeholder slide envelope.
- Validate this skill's local routing, references, interface file, scripts, and focused tests.

### Agent-owned

- Interpret the supplied lesson and preserve its terminology and intent.
- Decide which content items are distinct learning targets.
- Judge prerequisite relationships that depend on language-learning semantics.
- Choose the smallest set and order of post-opening exercises that closes the lesson.
- Choose slide interactions appropriate to each objective and author their educational content.
- Write source-alignment and research rationale without overstating what the evidence proves.
- Decide whether a proposed addition is source-derived or a Vocora extension.
- Judge whether missing assets materially block an exercise or permit a clearly labeled original parallel task.

### Codex-owned

- Codex is the agent execution role for the semantic responsibilities listed under `Agent-owned`; it must not move deterministic validation into prose.

### No manual fallback

- Do not return a plan that fails `validate-lesson-plan.py` and call it acceptable by inspection.
- Do not bypass missing source content by inventing lesson facts.
- Do not invent unsupported final slide-component configuration while the slide contract is a placeholder.
- Do not manually waive fixed-opening, prerequisite, evidence, or coverage failures; fix the plan or return a blocked result.
