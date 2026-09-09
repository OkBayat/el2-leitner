---
name: k2-design-system
description: Mandatory Vocora visual design system for palette, typography, spacing, layout, Angular Material controls, responsive behavior, accessibility, branding, and semantic feedback. Use before creating or changing any product-facing UI.
---

# K2 Design System

Use this skill as the canonical visual contract for Vocora.

Vocora uses a playful classroom-on-white-paper language: rounded shapes,
comfortable spacing, calm gray copy, and a small saturated palette that gives
interaction and learning feedback clear emotional weight.

## Scope

Use this skill before changing:

- product layout, spacing, typography, color, or visual hierarchy;
- buttons, links, controls, forms, cards, dialogs, navigation, or tables;
- hover, focus, selected, correct, incorrect, warning, or disabled states;
- responsive and mobile behavior;
- mascot, illustration, icon, PWA, or branded surfaces.

Do not use it for backend, database, deployment, or infrastructure-only work
with no visual effect.

## Canonical visual contract

- Light is the default theme; light and dark are both mandatory.
- Theme switching must preserve semantic meaning, hierarchy, content fit,
  focus, and disabled behavior.
- Paper White is the page and component canvas.
- Charcoal is primary copy; Pencil Gray is secondary copy.
- Eager Green owns primary CTA, progress, and correct-answer emphasis.
- Spark Blue owns links and outlined secondary actions.
- Faded Gray owns disabled content and outlined-control borders.
- Attention Yellow and Answer Red are Vocora semantic extensions for warning
  and incorrect/destructive feedback.
- Interactive shapes use a 12px radius and at least a 44px touch target.
- Buttons are flat: no gradients, elevation, or decorative shadows.
- Feature code consumes semantic variables and shared classes, never local raw
  colors or Material reskins.

## Required workflow

1. Read `references/DESIGN.md`.
2. Read `references/tokens.json` before selecting or extending a token.
3. Read `references/variables.scss` before implementing CSS variables.
4. Read `references/theme.css` when a Tailwind theme bridge is relevant.
5. Read `references/material-theme.scss` for Angular Material integration.
6. Reuse the existing token and component pattern.
7. Add a new token only when the requested semantic role is genuinely absent.
8. Define and verify light and dark behavior together.
9. Verify responsive layout, wrapped labels, focus, disabled state, and reduced
   motion for the changed surface.
10. Run the skill validator, its focused tests, and the affected product test.

## Angular Material button rule

Use Angular Material as the interaction primitive.

For a shared CTA, apply `vocora-button` and exactly one of:

- `vocora-button--primary`;
- `vocora-button--success`;
- `vocora-button--error`;
- `vocora-button--warning`;
- `vocora-button--secondary`.

Use `mat-flat-button` for filled intents and `mat-stroked-button` for the
secondary intent. Use the native `disabled` attribute for every disabled
state.

Do not apply CTA classes to answer-option tiles or other content-sized selection
controls. Those controls must retain content-driven height.

Do not create a feature-local Material override. Extend the central design
tokens, central Material adapter, and this reference together.

## Typography rule

Use `duolingo-sans` for body, navigation, controls, and subheadings, with the
documented fallback stack. Use `feather` only for display headlines at 48px or
larger, with Feather Bold or Nunito Black as fallback.

Do not use uppercase tracking on body copy. It is reserved for short controls
and navigation labels.

## Brand and imagery rule

The mascot and illustration language is flat, rounded, and bold. Illustration
colors do not automatically become UI tokens. Keep character art special and
avoid routine mascot decoration in dense study surfaces.

## Accessibility and responsiveness

- Keep visible keyboard focus.
- Preserve native disabled semantics.
- Do not communicate critical state by color alone.
- Keep interactive targets at least 44 x 44 CSS pixels.
- Let labels wrap instead of clipping them.
- Avoid horizontal overflow at the repository minimum viewport.
- Respect `prefers-reduced-motion`.

## Determinism Boundary

### Script-owned

The validator owns deterministic checks for:

- required skill structure and reference files;
- valid Design Tokens JSON;
- the exact canonical foundation palette and font token identities;
- complete light/dark semantic token parity;
- required CSS variable parity with the token source;
- required Material semantic mappings;
- documented five-intent button contract and native disabled rule.

### Codex-owned

Codex owns semantic visual judgment, including:

- hierarchy, density, composition, and responsive layout;
- whether an existing semantic token fits the requested meaning;
- readable foreground/background selection;
- appropriate mascot or illustration use;
- whether a genuinely new semantic extension is justified.
- whether light and dark variants preserve the same meaning and hierarchy.

### No manual fallback

- Do not bypass deterministic validation.
- If the validator fails, fix the canonical source, mapping, or validator; do
  not replace it with prose-only inspection.

## Stop conditions

Stop before implementation when:

- the requested semantic role is absent and cannot be represented honestly by
  the canonical palette;
- the requested font or asset is required exactly but is unavailable;
- a feature-local override would be needed because the central Material
  contract cannot express the requested behavior;
- accessibility or content fit cannot be preserved.

Report the missing system capability, extend the canonical design system when
authorized, validate it, and only then implement the product surface.

## References

- `references/DESIGN.md` — complete human-readable visual system.
- `references/tokens.json` — canonical machine-readable foundation.
- `references/variables.scss` — CSS custom properties and semantic aliases.
- `references/theme.css` — `@theme` bridge.
- `references/material-theme.scss` — Angular Material semantic bridge.
