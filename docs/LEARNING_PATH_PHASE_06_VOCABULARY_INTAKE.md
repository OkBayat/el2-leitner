# Learning Path Phase 6 — Vocabulary Intake

This implementation follows the locked Collection Learning Path architecture in `docs/COLLECTION_LEARNING_PATH.md`.

## Implemented contract

Phase 6 introduces the first production `vocabulary.intake` adapter without creating a second vocabulary-progress model.

- Exercise type: `vocabulary.intake`
- Schema version: `1`
- Completion policy: `vocabulary-intake`
- Supported scope in this phase: `listening-episode`
- Scope reference: the existing listening lesson public ID
- Vocabulary identity and Leitner progress remain global per learner.
- Learning Path resolves the episode's existing vocabulary collection and never copies vocabulary into Learning Path tables.
- Course progress authorization is sufficient; the learner does not need a second subscription to the episode vocabulary collection.

## State-preservation rule

The intake command reads the complete configured scope from the server and applies only this transition:

```text
new -> active, Box 1
```

It explicitly preserves:

```text
learning -> unchanged
mastered -> unchanged
excluded -> unchanged
```

The client never submits vocabulary IDs for activation. The type-specific command resolves the scope on the server, and the shared vocabulary activation repository re-checks current global state transactionally before writing.

## CQRS and boundaries

The implementation keeps reads and writes separated through `LearningPathVocabularyIntakeReader` and `LearningPathVocabularyIntakeWriter` ports. MySQL SQL remains in Infrastructure. HTTP only adapts requests to application commands. Exercise completion stays server-authoritative through the generic Learning Path completion command and the `vocabulary-intake` completion verifier.

The Angular runner uses the generic exercise host/registry contract. `VocabularyIntakeExerciseComponent` is a standalone OnPush renderer with separate TypeScript, HTML, SCSS, and spec files and uses Vocora semantic design tokens for both themes.

## Completion evidence

A `vocabulary.intake` exercise can complete only when the server resolves a non-empty configured scope and no item remains in the `new` state. The completion verifier records:

```text
evidence_type = vocabulary-intake
evidence_ref  = listening-episode:<episode-public-id>
```

This prevents a bare client completion boolean from bypassing intake.

## Verification

Phase-specific coverage includes:

- pure vocabulary-state and intake-definition tests;
- application command/query/completion-policy tests;
- MySQL adapter tests proving mixed-state preservation;
- an opt-in MySQL integration test proving episode vocabulary does not require a second collection subscription;
- HTTP authentication/identity tests for the type-specific command;
- Angular domain, facade, API, registry, host, renderer, and runner tests;
- a Playwright journey covering start → scoped activation → server-authoritative completion.
