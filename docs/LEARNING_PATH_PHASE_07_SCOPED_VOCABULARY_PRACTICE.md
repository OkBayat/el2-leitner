# Learning Path Phase 07 — Scoped Vocabulary Practice

## Goal

Phase 07 introduces `vocabulary.quick-review` as the first finite, lesson-scoped practice exercise. It reuses the global Leitner/review system instead of creating collection-local vocabulary progress.

The queue is always derived as:

```text
exercise vocabulary scope ∩ learner global House 1 state
```

For a lesson with 12 vocabulary entries, if only 7 of those entries are currently in the learner's global House 1, the exercise contains exactly those 7 entries.

## Domain rules

- Exercise type: `vocabulary.quick-review`
- Schema version: `1`
- Completion policy: `vocabulary-quick-review`
- Current supported scope: `listening-episode`
- Relevant global state in Phase 07: active vocabulary in House 1 only
- Unseen, House 2+, mastered and excluded entries are not eligible.
- Duplicate vocabulary identities in the scope are deduplicated.
- An empty eligible queue is a valid deterministic state and can complete without starting a practice session.
- Existing `user_vocabulary_progress` remains the single source of truth for Leitner state.

## CQRS and boundaries

The Learning Path read side hydrates the exercise through `GetScopedVocabularyQuickReviewContext`. Scope resolution and intersection rules live in the Learning Path domain. MySQL remains behind infrastructure adapters.

The exercise itself records answers through the existing review pipeline (`ReviewSessionService` → review persistence → `RecordReviewResult`). Phase 07 adds a finite scoped Box 1 entry point to that service; it does not duplicate `applyReview`, review persistence, Leitner transitions, review events, practice sessions, or daily statistics.

Learning Path completion is server-authoritative. The client submits the completed practice session public id as evidence. `VerifyScopedVocabularyQuickReviewCompletion` accepts it only when:

1. the session belongs to the current user;
2. its mode is `learning-path.quick-review`;
3. the session is completed;
4. planned/completed counts equal the current eligible scoped queue; and
5. persisted `review_events` for that session contain exactly the scoped vocabulary identities.

The persisted Learning Path evidence points to the scope and verified practice session. A generic client-side `completed: true` flag is insufficient.

## UI

The Angular exercise is a standalone component with separate `.ts`, `.html`, `.scss`, and `.spec.ts` files and `OnPush` change detection. It is registered through the generic exercise registry as `vocabulary.quick-review`.

The practice is deliberately fast: one scoped word at a time, pronunciation replay, and `Remembered` / `Needs work` actions. The finite scoped session uses the existing Box 1 review rules while disabling the normal same-session remediation loop for this rapid exercise only. Existing Review page behavior is unchanged.

## Persistence and migrations

No migration is required for Phase 07. Existing tables are reused:

- `user_vocabulary_progress` for global Leitner state;
- `practice_sessions` for session evidence;
- `review_events` for per-vocabulary persisted review evidence;
- existing Learning Path progress tables for exercise completion evidence.

## Tests

Phase-specific tests cover:

- only in-scope House 1 vocabulary is selected;
- House 2+, mastered, excluded and unseen vocabulary are excluded;
- duplicate scope identities are deduplicated;
- empty queues are safe;
- user reads remain isolated;
- invalid exercise definitions are rejected;
- completion requires a completed Learning Path quick-review session;
- wrong-mode, incomplete, and cross-scope evidence is rejected;
- Angular registry resolution;
- finite scoped session startup and evidence emission;
- empty UI flow without a fabricated practice session.

Regression behavior for existing `vocabulary.intake` and normal Review/House 1 flows remains unchanged by default.
