# CQRS

Use CQRS only when the task changes a meaningful command/query, read/write
model, or projection boundary.

- Give each command one mutation intent and an explicit transaction boundary.
- Keep queries free of mutation.
- Keep read DTOs and projections separate from domain and persistence models.
- Keep write-side invariants authoritative.
- Make consistency, idempotency, replay, and projection recovery explicit when
  the changed boundary needs them.

Do not require command classes for trivial operations, separate physical
databases, event sourcing, or new projections without a concrete need.
