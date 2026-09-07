---
name: k2-design-system
description: Mandatory visual design system for all Vocora UI work, including color, light/dark theming, typography, spacing, layout, component styling, responsive behavior, PWA surfaces, branding, mascot usage, and semantic states. Use before creating or modifying any visual product surface. Do not use for backend- or infrastructure-only changes with no visual impact.
---

# K2 Design System

Use this skill as the source of truth for visual design work in Vocora.

Vocora is a language-learning application intended for long daily study sessions. Its UI must remain simple, calm, focused, friendly, readable, and visually consistent across the product.

## Mandatory theme contract

Vocora always supports both light and dark themes.

- Light theme is the default theme.
- Every visual change must be designed for light and dark themes at the same time.
- A component is not complete if only one theme has been designed or validated.
- Every semantic color token that can appear in the UI must define a light-theme value and a dark-theme value.
- Do not implement dark mode as a later inversion pass. Dark mode is a first-class design target.
- Theme behavior must preserve meaning, hierarchy, contrast, and state identity across both themes.

## When this skill is mandatory

Use this skill before changing any of the following:

- page layout or page chrome;
- color or theme behavior;
- typography;
- spacing;
- border radius;
- shadows and elevation;
- buttons and controls;
- cards, dialogs, popovers, menus, tables, chips, and badges;
- forms and input states;
- navigation and timeline UI;
- empty, loading, success, error, warning, and disabled states;
- responsive behavior;
- PWA visual surfaces;
- illustrations, mascot placement, and brand visuals.

Do not use this skill for backend, database, deployment, or infrastructure-only changes that have no visual effect.

## Required workflow

1. Read `references/DESIGN.md` before making a visual change.
2. Read `references/tokens.json` when choosing or introducing design tokens.
3. Read `references/variables.scss` when implementing token usage in SCSS/CSS.
4. Read `references/material-theme.scss` when changing Angular Material theme integration.
5. Reuse existing semantic tokens and patterns before adding new ones.
6. Design the light-theme and dark-theme behavior together.
7. Validate responsive behavior, contrast, focus states, disabled states, and motion behavior.
8. Run the skill validator and focused skill tests before finalizing the change.

## Core visual principles

Vocora should feel:

- simple;
- friendly;
- focused;
- calm enough for long study sessions;
- playful without becoming noisy or childish;
- visually consistent across features;
- easy to scan on mobile first.

Prefer clear hierarchy, generous whitespace, restrained decoration, and explicit interaction states.

Do not add UI elements only to fill empty space.

## Brand identity

Vocora's visual identity is centered around a green parrot mascot and a restrained palette built from:

- Vocora Green;
- Vocora Mint;
- Vocora Teal;
- Vocora Orange;
- neutral surface and text colors.

The mascot is a brand asset, not a general-purpose decorative element.

## Semantic color rule

Components must consume semantic tokens instead of deciding raw colors locally.

A component should express intent such as:

- primary;
- secondary;
- success;
- information;
- warning;
- error;
- disabled;
- mastered;
- leitner-active;
- not-started;
- future.

Do not hard-code raw hex values in feature components when a design token exists or should exist.

## Light and dark theme rule

Every visual token must be considered in both themes.

At minimum, both themes must define:

- page background;
- surface;
- raised surface;
- subtle surface;
- border;
- text primary;
- text secondary;
- text disabled;
- primary action;
- primary action foreground;
- secondary action;
- focus ring;
- success;
- information;
- warning;
- error;
- mastered;
- leitner-active;
- not-started;
- future;
- disabled;
- brand accent colors.

Light theme remains the default application theme.

## UI constraints

Avoid:

- page-specific color palettes;
- arbitrary raw color values;
- unnecessary gradients;
- heavy shadows;
- excessive borders;
- decorative color with no semantic purpose;
- repeated mascot placement across dense practice UI;
- pixel-for-pixel imitation of another product's visual system.

## Accessibility

- Meet WCAG AA contrast for normal text and interactive content where applicable.
- Do not rely on color alone to communicate critical state.
- Keep keyboard focus visible in both themes.
- Keep interactive touch targets at least 44 x 44 CSS pixels when practical.
- Preserve readable disabled states without making content disappear.
- Respect `prefers-reduced-motion`.

## Responsive design

- Design mobile first.
- Support the repository's existing minimum viewport width.
- Avoid horizontal overflow.
- Keep primary actions reachable on small screens.
- Reduce nonessential metadata before reducing readability.
- Use responsive variants for dense tables and multi-column layouts.

## Mascot usage

Appropriate mascot contexts include:

- onboarding;
- important empty states;
- meaningful achievements;
- PWA install surfaces;
- streak or milestone feedback;
- selected branded loading states.

Avoid routine mascot decoration in:

- tables;
- dense practice cards;
- repeated list rows;
- every button or panel.

## Determinism Boundary

### Script-owned

The validator owns deterministic checks for:

- required skill file structure;
- valid token JSON syntax;
- required light and dark theme branches;
- required token groups;
- valid hex color syntax where hex values are used;
- duplicate or missing semantic tokens;
- required light/dark parity for semantic color keys;
- expected source-reference files.

### Codex-owned

Codex owns semantic design judgment, including:

- visual hierarchy;
- token selection by meaning;
- layout choices;
- density;
- responsive composition;
- readability;
- whether mascot usage is appropriate;
- whether a new token or pattern is justified;
- whether light and dark versions preserve the same interaction meaning.

### No manual fallback

- Do not bypass or replace deterministic validation with manual inspection.

- If the validator fails, fix the skill source, token data, or validator. Do not disable the rule, ignore the failure, or substitute prose-only verification.

## Stop conditions

If a requested UI change needs a visual concept not covered by the design system:

1. stop before inventing a local visual language;
2. identify the missing semantic token or reusable pattern;
3. extend the design system coherently for both light and dark themes;
4. validate the new system rule;
5. then implement the product change.

Never create a parallel visual system inside a feature.

## Source-of-truth references

- `references/DESIGN.md` — human-readable visual rules and component guidance.
- `references/tokens.json` — machine-readable canonical tokens for both themes.
- `references/variables.scss` — SCSS/CSS custom-property mapping reference.
- `references/material-theme.scss` — Angular Material integration reference.
