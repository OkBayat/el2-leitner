# Learning Path Phase 08 — Vocabulary Mastery Revalidation

## Scope

Phase 08 implements the `vocabulary.mastery-check` exercise for Collection Learning Paths.

The exercise revalidates vocabulary that is already mastered in the learner's global Leitner state and belongs to the configured lesson/source scope. It does not create a second mastery model and it does not introduce a course-local vocabulary progress table.

## Locked contract

- Exercise type: `vocabulary.mastery-check`
- Schema version: `1`
- Completion policy: `vocabulary-mastery-check`
- Practice-session mode: `learning-path.mastery-check`
- Supported scope in this increment: `listening-episode`
- Eligible queue: configured scope intersected with globally mastered vocabulary
- Previously unseen, learning, and excluded vocabulary are not eligible
- All currently eligible mastered items are revalidated; Phase 08 does not invent a sample-size or pass threshold
- Queue order may be shuffled, but the authoritative start snapshot is persisted server-side
- A correct answer preserves the existing mastered state through the existing review/Leitner rules
- A wrong answer uses the existing review/Leitner rule and returns the word to House 1
- No separate mastery scoring or demotion algorithm is introduced

## Why completion uses a start snapshot

A mastery check cannot safely recompute its expected queue at completion time. A wrong answer intentionally changes global vocabulary state from mastered to House 1, so that item would disappear from a freshly computed mastered queue.

For a non-empty mastery check the server therefore:

1. resolves the configured scope;
2. intersects it with the learner's current global mastered state;
3. creates a dedicated `practice_sessions` row;
4. stores the exact ordered vocabulary IDs in the existing `metadata_json` column;
5. returns the server-authoritative queue to the client.

Completion verifies the persisted snapshot, not the learner's post-answer mastery state.

The persisted metadata shape is versioned:

```json
{
  "learningPath": {
    "kind": "vocabulary.mastery-check",
    "schemaVersion": 1,
    "exerciseId": "<exercise-public-id>",
    "scope": {
      "kind": "listening-episode",
      "ref": "<episode-public-id>"
    },
    "vocabularyIds": ["<vocabulary-public-id>"]
  }
}
```

No migration is required because `practice_sessions.metadata_json` already exists and is the appropriate variable-shape evidence envelope.

## Completion evidence

A non-empty exercise can complete only when the authenticated learner supplies a completed practice-session ID and the server verifies all of the following:

- session belongs to the same learner;
- session mode is `learning-path.mastery-check`;
- session status is completed;
- metadata kind/schema/exercise/scope match the exercise definition;
- `planned_count` and `completed_count` match the snapshot length;
- correct + wrong counts match the snapshot length;
- review events contain every snapshotted vocabulary ID exactly once;
- there are no missing, extra, or duplicate reviewed vocabulary IDs.

An empty mastery scope is a valid no-session completion, but emptiness is recomputed server-side before completion is accepted.

## CQRS / DDD boundaries

### Read side

`GetVocabularyMasteryCheckContext` hydrates the exercise with the current scoped mastered vocabulary.

`LearningPathMasteryCheckEvidenceReader` reads persisted completion evidence. SQL remains in its MySQL adapter.

### Write side

`StartVocabularyMasteryCheck` validates Learning Path access/progression, creates the server-authoritative queue snapshot, and opens the dedicated practice session through `LearningPathMasteryCheckSessionWriter`.

The existing review command/persistence remains authoritative for vocabulary state changes. Learning Path does not write Leitner progress directly.

### Interface

Express only maps authenticated HTTP requests to the application commands/queries. Domain and Application remain independent of Express and MySQL so the future NestJS migration can replace composition/interface adapters without rewriting mastery behavior.

## Angular runtime

`VocabularyMasteryCheckExerciseComponent` is registry-driven and uses separate `.ts`, `.html`, `.scss`, and `.spec.ts` files with standalone + `OnPush` conventions.

The component requests the server-authoritative start snapshot, then reuses `ReviewSessionService` with the returned existing practice-session ID. The review service does not create a second session for mastery revalidation.

## TDD coverage

Phase 08 tests cover:

- definition/schema/scope validation;
- exact mastered-state filtering and deduplication;
- cross-user scoped read isolation;
- authoritative session snapshot creation;
- empty scope without session creation;
- completion after a wrong answer has already demoted a snapshotted word;
- rejection of wrong mode/status/counts/scope/exercise/extra/duplicate review evidence;
- Angular payload parsing;
- server start ordering;
- component session/evidence behavior;
- Exercise Registry resolution.

## Deferred product decisions

The architecture contract intentionally defers scoring thresholds and future sample-size rules. Phase 08 therefore records correctness for reporting and applies existing vocabulary transitions, but does not invent a pass/fail threshold.
