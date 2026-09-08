---
type: Rule
title: Vocabulary-Led Lesson Design
description: Preserve source truth and evidence boundaries when designing Vocora lesson exercise sequences.
tags: [learning-path, lesson-design, vocabulary, evidence]
timestamp: 2026-09-08T05:03:13Z
---

Vocora's `k2-lesson-exercise-design` workflow is for vocabulary-led lessons. It produces a design artifact with ordered exercises and slide intentions; it does not own application runtime schemas or implementation.

# Rules

* Inventory source targets and source gaps before sequencing exercises.
* Keep vocabulary intake and spelling/dictation as the first two exercises. Their declared source scope must exactly equal the lesson's Leitner-eligible targets.
* Derive later exercises from source targets and real prerequisite relationships. Do not add an exercise merely to use an available slide type.
* An exercise objective and a slide interaction are different concepts. Every target declared by an exercise must appear in at least one of its slides, and a slide must not reference a target outside that exercise's declared scope.
* A plan with a declared source gap cannot be marked `ready`.
* Keep research findings separate from Vocora design synthesis. Correlation between vocabulary knowledge, spoken-word recognition, and listening performance does not prove that one universal lesson sequence causes better comprehension.
* Treat vocabulary preparation as a prerequisite aid, not as a replacement for guided listening or full listening practice.
* Keep the current placeholder slide-data envelope fail-closed until the owning application runtime contracts are deliberately integrated; do not invent production fields in the design artifact.

# Citations

[1] [K2 Lesson Exercise Design skill](../../.agents/skills/k2-lesson-exercise-design/SKILL.md)
[2] [Lesson learning-design rules](../../.agents/skills/k2-lesson-exercise-design/references/learning-design-rules.md)
[3] [Canonical lesson-plan output contract](../../.agents/skills/k2-lesson-exercise-design/references/output-contract.md)
[4] [Lesson-plan validator](../../.agents/skills/k2-lesson-exercise-design/scripts/validate-lesson-plan.py)
[5] [Vocabulary knowledge and advanced listening comprehension](https://doi.org/10.1017/S0272263109990039)
[6] [Recognition of high frequency words from speech as a predictor of L2 listening comprehension](https://doi.org/10.1016/j.system.2015.04.015)
[7] [The impact of vocabulary preparation on L2 listening comprehension, confidence and strategy use](https://doi.org/10.1016/j.system.2007.06.003)
