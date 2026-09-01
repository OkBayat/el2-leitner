# Frontend Architecture

Vocora uses an incremental feature migration strategy. The goal is to create durable boundaries without a risky big-bang rewrite of the existing learning application.

## Source layout

```text
ui/
  src/
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

## HTTP

`src/shared/http/HttpClient.js` centralizes browser transport mechanics such as credentials, JSON encoding, response parsing, and canonical API errors. Feature infrastructure owns endpoint knowledge.

## Design system

`src/design-system/material3.css` is the final visual cascade owner. It contains Material 3 roles and shared component states. Feature stylesheets should primarily own layout and feature-specific composition.

The compatibility custom properties (`--primary`, `--surface`, etc.) are migration aliases to Material roles. They are temporary adapters for legacy feature CSS, not an independent palette.

## Legacy migration policy

Large existing modules such as `app-v2.js` and `library.js` stay in place until their feature can be migrated with complete regression coverage. New feature code is not allowed to expand the root-level JavaScript surface.

When a feature is migrated:
1. Write/extend behavior and architecture tests first.
2. Introduce the feature boundary under `src/features`.
3. Route the entry point to the new composition root.
4. Run existing regression tests against the new owner.
5. Delete the replaced root implementation.
6. Run the full CI suite.

This strangler-style approach keeps changes surgical and avoids maintaining two live implementations.

## Why there is no frontend framework/bundler yet

Native ES modules are sufficient for the current static Express-served frontend and preserve a small dependency surface. Adding Vite, React, Lit, or another runtime/build layer without a demonstrated requirement would add migration risk and violate YAGNI. A build tool can be introduced later when concrete needs such as package-based components, code splitting, TypeScript compilation, or production bundling justify it.
