---
type: Concept
title: Vocora Domain Boundaries
description: Durable product-domain boundaries for learning delivery, retention, progress, gamification, and social features in Vocora.
tags: [architecture, ddd, learning-path, leitner, progress, gamification, social]
timestamp: 2026-09-08T08:01:00Z
---

Vocora separates learning truth from retention mechanics and motivational or
social features. This boundary is product-level knowledge; it should guide later
backend, data-model, and framework decisions without forcing premature technical
abstractions.

# Learning Content And Delivery

The learning-content domain owns the ordered learning experience: learning
paths, lessons, exercises, slide sequences, source material, prerequisites, and
completion evidence.

A goal-oriented journey such as IELTS must not be modeled merely as a playlist
of independent book paths. It may combine material from multiple books or other
sources into one coherent progression, choosing the right vocabulary, grammar,
listening, writing, speaking, or other activity at each stage. Source-scoped
learning paths, such as a path based on one vocabulary book, can still exist as
standalone experiences.

A course may expose a coherent goal-oriented journey, but the exact cardinality
between `Course` and `LearningPath` is not yet fixed. Preserve the semantic rule
that a course is a designed learning progression, not just concatenation of
unrelated paths.

Lesson and exercise completion belongs to this domain. Global learning progress
must not be inferred from a vocabulary item's Leitner house.

For reusable exercise and slide behavior, use
[Reusable Slide Interactions](/project/reusable-slide-interactions.md).

# Retention And Mastery

The Leitner system is a separate retention domain. Its initial study items are
vocabulary and collocations, and it may train several aspects of the same item
without owning lesson completion.

For the current Leitner progression, the decisive promotion evidence is
spelling through dictation: the learner hears the word or collocation and writes
it. Correct sound-to-written-form recall moves the item forward according to the
Leitner rules; an incorrect response moves it backward according to those rules.
Meaning practice can accompany the review flow, but semantic recognition is not
currently the promotion gate.

This separation is intentional: learning-path progress answers "what learning
content has the learner completed?" while Leitner state answers "what retained
language item is due and how strongly has its written form been recalled?"
Neither state should overwrite the other.

# Learner Progress And Proficiency Projection

Vocora may expose milestones that translate accumulated learning evidence into
understandable proficiency guidance, including CEFR stages such as A1 or A2 and
approximate IELTS-readiness bands.

These milestones are projections from learning and assessment evidence, not
exam-score guarantees or a substitute for an official proficiency test. A
Leitner house by itself is not sufficient evidence for a CEFR or IELTS milestone.

# Gamification

Gamification is a supporting domain, not the owner of learning correctness or
mastery. It includes at least:

* XP or points earned from qualifying learning activity;
* streak state derived from continued qualifying activity;
* motivational rewards built on top of learning and retention events.

Gamification should consume facts produced by the learning and retention
domains. It must not redefine whether an exercise answer is correct, whether a
lesson is complete, or whether a Leitner item advances.

A spendable reward economy may later provide streak-related benefits or other
virtual rewards, but the exact earning formula, prices, streak protection or
restoration mechanics, and store catalog are not yet durable domain rules.

# Social

Social functionality is a separate supporting domain. It can own relationships
such as following another learner and later expose social views built from
public learner or gamification projections.

The social graph must not own learning-path completion, Leitner state, XP
calculation, or streak correctness. Those facts remain authoritative in their
own domains and are projected into social experiences when needed.

# Boundary Rules

* Learning content owns lesson, exercise, slide-sequence, prerequisite, and
  completion semantics.
* Retention owns Leitner scheduling, house movement, and item-level review
  evidence.
* Progress/proficiency projects learning evidence into learner-facing milestones.
* Gamification reacts to authoritative learning or retention facts and owns XP,
  points, streaks, and rewards.
* Social owns learner relationships and social presentation, not learning truth.
* Cross-domain integration should use explicit application contracts or events;
  one domain must not reach into another domain's persistence model to change its
  invariants.

# Deliberately Unfixed

The following are intentionally not recorded as settled contracts yet:

* exact `Course` to `LearningPath` cardinality;
* XP formulas and point values;
* streak freeze, repair, purchase, or restoration rules;
* leaderboard, league, quest, or marketplace behavior;
* any commercial buying/selling domain;
* backend framework migration details such as Express versus NestJS.

These decisions should be added to OKF only after the product behavior becomes
explicit and durable.

# Citations

[1] Product/domain discussion with the project owner, 2026-09-08 (current task scope).
[2] [Reusable Slide Interactions](/project/reusable-slide-interactions.md)
[3] [Repository Source Of Truth](/project/repository-source-of-truth.md)
