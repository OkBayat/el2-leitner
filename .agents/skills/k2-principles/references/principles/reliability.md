# Reliability

Apply these reminders to long-running and operational behavior.

- Bound timeouts, retries, concurrency, and backoff.
- Make retries idempotent or explicitly guarded.
- Preserve graceful shutdown and stale-work handling.
- Expose structured, actionable failure states.
- Provide reconciliation, recovery, and safe resume where the changed behavior
  needs them.
- Prefer dry-run or local-only verification for operational mutations.

Do not add retry, recovery, or observability machinery without a concrete
failure mode.
