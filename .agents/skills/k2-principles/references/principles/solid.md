# SOLID

Apply SOLID only at the boundary changed by the task.

- Give each changed module one clear reason to change.
- Extend through a cohesive responsibility instead of growing a central
  conditional dump.
- Preserve substitutability across an existing interface.
- Expose the smallest interface required by each consumer.
- Keep domain decisions dependent on explicit ports rather than infrastructure
  details.

Do not introduce interfaces, factories, containers, or abstraction layers when
one direct implementation is simpler and sufficient.
