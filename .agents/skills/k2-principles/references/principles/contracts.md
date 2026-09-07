# Contracts

Apply these reminders to machine-readable and external boundaries.

- Use one canonical field or token for each concept.
- Use `snake_case` for new or explicitly migrated agent-facing JSON fields.
- Update producers, consumers, validators, fixtures, tests, generated output,
  and documentation together when a contract changes.
- Define accepted values positively and reject unknown values generically.
- Keep provider-specific models behind adapters.
- Validate runtime input at the boundary.

Keep exactly one accepted canonical name for each concept. When a migration is
required, replace that contract atomically across every participating surface.
