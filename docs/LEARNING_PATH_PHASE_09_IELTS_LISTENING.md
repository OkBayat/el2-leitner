# Learning Path Phase 09: IELTS Listening Exercise

Status: **implementation contract**

This phase implements `listening.ielts` as an adapter from Collection Learning Path to Vocora's existing Listening bounded context. It follows `docs/COLLECTION_LEARNING_PATH.md` and does not create a second listening engine.

## Scope

- Exercise type: `listening.ielts`
- Schema version: `1`
- Definition config: `{ "lessonSlug": "...", "testId": "..." }`
- Completion policy: server-verifiable submitted listening attempt
- UI: reuse the existing BBC IELTS listening practice experience through an embedded adapter surface
- Existing `/bbc-6-minute-english/...` routes remain independently usable

## Domain boundaries

Collection Learning Path owns only orchestration and completion policy. Listening remains authoritative for:

- published lesson/test content;
- audio URLs and ownership;
- attempt creation;
- question presentation data;
- grading;
- completed attempt snapshots.

The Learning Path definition never stores question bodies or answer keys. The hydrated context exposes only the existing public Listening projection.

## CQRS

`GetIeltsListeningExerciseContext` is a Learning Path query. It resolves and validates the persisted exercise reference, then reads public lesson/test data through a Listening anti-corruption port. It does not create an attempt.

Listening attempt creation/submission continues through the existing Listening command path used by `ListeningAttemptService`.

`VerifyIeltsListeningCompletion` is the server-side completion policy invoked by `CompleteExercise`. A client-provided `attemptId` is only a reference; completion is accepted only when the server finds a completed attempt for the same authenticated learner and that attempt matches the configured lesson and test.

## Evidence invariants

Completion must fail closed when:

- no attempt id is supplied;
- the attempt is missing;
- the attempt belongs to another learner;
- the attempt is still active or otherwise not completed;
- the attempt belongs to another lesson;
- the attempt belongs to another test;
- the attempt is not from the current BBC listening provider used by the existing Listening domain.

Persisted Learning Path evidence uses:

- `evidenceType = listening-attempt`
- `evidenceRef = <submitted attempt public id>`

## Angular integration

`IeltsListeningExerciseComponent` implements the generic Learning Path exercise contract and is registered under `listening.ielts`.

The existing BBC listening practice page gains an explicit embedded input/output surface rather than being copied:

- `lessonSlug`
- `testId`
- `embedded`
- `attemptSubmitted`

The standalone route continues to resolve identifiers from `ActivatedRoute` when explicit inputs are absent. Embedded mode suppresses route-specific navigation actions. All Learning Path component template/style files remain separate and use `OnPush`.

The generic runtime context exposes the exercise state so an already-completed IELTS exercise does not create a fresh listening attempt when revisited.

## TDD acceptance tests

Backend tests cover:

- definition validation;
- query-only context hydration;
- public projection / answer-key protection;
- matching submitted attempt acceptance;
- missing, active, cross-user, cross-lesson, and cross-test rejection.

UI tests cover:

- payload validation;
- registry composition;
- normalized `attemptId` completion outcome;
- completed-exercise no-restart behavior;
- explicit embedded identifiers overriding route parameters.

No database migration is required in this phase.
