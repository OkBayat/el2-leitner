# Data Integrity

Apply these reminders when authoritative state or persistence changes.

- Define transaction and concurrency boundaries.
- Preserve one authoritative owner for learner progress, vocabulary state,
  listening attempts, learning-path progress, and other persisted domain state.
- Keep migrations recoverable and compatible with the accepted rollout plan.
- Consider idempotency, replay, reconciliation, and failure recovery.
- Prevent optimized reads from bypassing write-side invariants.

Persistence work alone does not imply CQRS.
