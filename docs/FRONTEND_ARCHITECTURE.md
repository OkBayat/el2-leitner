# Frontend Architecture

Vocora uses an incremental feature migration strategy. The goal is to create durable boundaries without a risky big-bang rewrite of the existing learning application.

## Source layout

```text
ui/
  rollup.config.js
  src/
    material-web.js
    design-system/
      material3.css
    shared/
      http/
      navigation/
    features/
      auth/
        application/
        infrastructure/
        presentation/
        index.js
      leitner-house/
        domain/
        application/
        infrastructure/
        presentation/
        index.js
  dist/                     # generated, not committed
    material-web.js
```

## Dependency direction

```text
presentation -> application -> domain
      |              ^
      v              |
  injected ports     |
      ^              |
      |              |
infrastructure ------+

shared -> no feature
composition root -> all concrete feature dependencies
```

Domain is optional: create it only for real business rules or invariants. Formatting, sorting a UI read model, and DOM behavior are not domain behavior.

## CQRS

Commands and queries are explicit application objects. They describe intent and depend on injected gateways. Vocora intentionally does not have a generic command bus or query bus because the current scale does not justify that abstraction.

## Composition roots

Each migrated feature exposes `index.js`. This is the only place in that feature where concrete infrastructure is constructed. Presentation receives application operations rather than creating HTTP adapters.

A feature that consumes Material Web waits for the required custom-element definitions before mounting its controller. Material component registration remains independent from application/domain state.

## HTTP

`src/shared/http/HttpClient.js` centralizes browser transport mechanics such as credentials, JSON encoding, response parsing, and canonical API errors. Feature infrastructure owns endpoint knowledge.

## Material 3 and Material Web

Vocora separates **theme ownership** from **component implementation**:

- `src/design-system/material3.css` owns the Vocora Material 3 color roles, typography, shape, elevation, motion, light/dark theme values, and compatibility aliases for not-yet-migrated legacy CSS.
- `@material/web` owns standard Material primitives such as filled/outlined buttons, text fields, and selects.
- `src/material-web.js` imports only the component definitions that Vocora currently uses. It intentionally does not import `@material/web/all.js`.
- Feature presentation CSS owns layout and feature-specific composite states. It does not recreate Material primitive internals.

The current migrated component set is intentionally small:

```text
md-filled-button
md-outlined-button
md-outlined-text-field
md-outlined-select
md-select-option
```

Auth and Leitner house detail consume those primitives directly. New/migrated features should use official Material Web primitives when an equivalent component exists instead of introducing another CSS implementation.

## Production build

Material Web package imports use bare module specifiers, so the production browser asset is built with Rollup and `@rollup/plugin-node-resolve`, following the Material Web production quick-start model.

```text
src/material-web.js
        |
        v
      Rollup
        |
        v
dist/material-web.js
```

`dist/` is generated and ignored by git. `npm test` builds it before component integration tests. Docker has a dedicated UI build stage that runs `npm ci` and `npm run build`, then copies the built UI into the runtime image without carrying the build `node_modules` directory.

The package and build-tool versions are pinned in `ui/package-lock.json`; CI uses `npm ci` so production and tests resolve the same dependency graph.

## Legacy migration policy

Large existing modules such as `app-v2.js` and `library.js` stay in place until their feature can be migrated with complete regression coverage. New feature code is not allowed to expand the root-level feature JavaScript surface.

The existing Material-like CSS for legacy controls is compatibility code only. It must not be used as the implementation pattern for new features. When a legacy feature is migrated, its standard controls should move to Material Web and its obsolete primitive CSS should be removed.

When a feature is migrated:
1. Write/extend behavior and architecture tests first.
2. Introduce the feature boundary under `src/features`.
3. Use official Material Web primitives for standard controls where available.
4. Route the entry point to the new composition root and Material bundle when needed.
5. Run existing regression tests against the new owner.
6. Delete the replaced root implementation and obsolete primitive CSS.
7. Run the full CI and Docker suites.

This strangler-style approach keeps changes surgical and avoids maintaining two live implementations.

## Why there is still no application framework

The concrete package-component need now justifies a small build step, not an application-framework rewrite. Rollup resolves the official Material Web components while the rest of Vocora remains native ES modules.

React, a generic Lit application layer, Vite, an event bus, service locator, or a broader framework migration would add a much larger ownership and migration surface without solving a demonstrated current problem. They should be introduced only when a separate concrete requirement justifies them.
