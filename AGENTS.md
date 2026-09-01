# Vocora Engineering Guidelines

These rules apply to every change in this repository.

## 1. Think before coding
- State the observable success criteria before implementation.
- Inspect existing behavior, tests, and ownership before changing code.
- Do not guess about a dependency, state transition, persistence rule, or browser behavior when the repository can answer it.

## 2. TDD and regression safety
- A behavior change starts with a failing test or an explicit extension of an existing regression test.
- Every fixed bug must keep a regression test reproducing the failure shape.
- Architecture constraints that protect ownership or dependency direction belong in automated tests.
- Run the full affected suite, not only the new focused test.

## 3. KISS / YAGNI / Karpathy-style surgical changes
- Prefer the smallest architecture that satisfies a demonstrated need.
- Do not introduce a framework, event bus, generic repository, service locator, or abstraction only for possible future use.
- Do not rewrite a stable large subsystem merely to make it look architecturally uniform.
- Migrate feature-by-feature with preserved behavior and a clear rollback surface.
- Keep unrelated cleanup out of a feature change.

## 4. DDD
- Domain code owns business invariants and rules, not formatting, DOM behavior, HTTP details, or generic helpers.
- A feature without meaningful domain rules does not need an artificial domain model.
- Domain modules must not depend on application, infrastructure, or presentation.

## 5. CQRS
- Name application operations by intent: commands change state; queries read state.
- Keep command/query objects explicit and small.
- Do not add a generic command/query bus until multiple concrete consumers prove that it reduces complexity.

## 6. SOLID and dependency direction
- High-level application and presentation code depend on narrow contracts, not concrete transport implementations.
- Construct concrete dependencies only in a composition root (`index.js` for a frontend feature or the backend container).
- Presentation must not instantiate HTTP gateways directly.
- Shared code must never depend on a feature.

## 7. Frontend structure
New frontend feature code belongs under:

```text
ui/src/features/<feature>/
  domain/          # only when real invariants exist
  application/     # commands, queries, read-model transformations
  infrastructure/  # HTTP/browser adapters
  presentation/    # DOM controllers and feature layout
  index.js          # composition root
```

Cross-feature primitives belong in `ui/src/shared/`. The visual system belongs in `ui/src/design-system/`.

The existing root-level frontend scripts are legacy migration surfaces. New features must not add new root-level JavaScript files. When a legacy feature is migrated, delete the previous owner after its regression suite passes against the new implementation.

## 8. Material 3
- Material 3 is a presentation concern only.
- `ui/src/design-system/material3.css` owns shared visual roles and states.
- Feature CSS owns feature layout, not a second palette.
- Do not add Material JavaScript/runtime dependencies unless a concrete component need justifies the cost and is covered by tests.

## 9. Definition of done
A change is not done until:
- focused tests pass,
- affected regression tests pass,
- architecture constraints pass,
- full repository CI relevant to the change passes,
- dead replaced code is removed,
- no duplicate state owner or duplicate visual source of truth was introduced.
