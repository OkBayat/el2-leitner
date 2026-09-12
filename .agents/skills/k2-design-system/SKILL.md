---
name: k2-design-system
description: Mandatory Vocora visual and frontend-primitive contract for shared UI, Angular Material, Angular CDK, Bootstrap utilities, custom CSS, themes, accessibility, and branding. Use before creating or changing any product-facing UI.
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
- Charcoal is primary copy and secondary-button copy; Pencil Gray is secondary
  descriptive copy.
- Spark Blue owns primary CTA and links.
- Eager Green owns success, progress, and correct-answer emphasis.
- Faded Gray owns disabled content and routine outlined-control borders; button
  states use the exact lighter grays from their supplied visual references.
- Attention Yellow and Answer Red are Vocora semantic extensions for warning
  and incorrect/destructive feedback.
- Textual Angular Material buttons use a 13px radius, a 44px face, and a 4px
  lower edge while retaining content-driven height.
- Buttons use no gradients or ambient elevation; their only depth cue is the
  canonical 4px lower edge.
- Textual Material buttons use no CSS transition. Press, release, color, border,
  and lower-edge changes are all immediate.
- Feature code consumes semantic variables and shared classes, never local raw
  colors or Material reskins.
- An existing Vocora shared primitive is always the first implementation choice.
- Angular Material owns standard interaction semantics when no Vocora primitive
  exists; Angular CDK owns lower-level behavior when Material has no suitable
  higher-level component.
- Bootstrap is the utility layer, not the interactive component library.
- Custom CSS is last and must have a concrete reason to exist.

## UI implementation hierarchy

Apply the complete decision tree and ownership rules in
`references/DESIGN.md`. In order: reuse an existing Vocora shared primitive;
use Angular Material for a suitable standard interactive component; use Angular
CDK for lower-level behavior; create a reusable product-specific primitive in
`ui/src/app/shared` when needed; use Bootstrap for exact built-in presentation
utilities; reuse shared styles and semantic tokens; then add only the minimal
custom implementation.

Do not introduce Bootstrap JavaScript widgets, feature-local reusable
primitives, a giant `SharedModule`, feature-owned framework theme variables, or
feature selectors that redesign undocumented Material internals. When touching
legacy UI, apply the bounded touch-to-refactor rule from the design reference.

## Required workflow

1. Read `references/DESIGN.md`.
2. Read `references/tokens.json` before selecting or extending a token.
3. Read `references/variables.scss` before implementing CSS variables.
4. Read `references/theme.css` when a Tailwind theme bridge is relevant.
5. Read `references/material-theme.scss` for Angular Material integration.
6. Inspect `ui/src/app/shared` and apply the UI implementation hierarchy before
   choosing a primitive or adding CSS.
7. Reuse the existing token and component pattern.
8. Add a new token only when the requested semantic role is genuinely absent.
9. Define and verify light and dark behavior together.
10. Verify responsive layout, wrapped labels, focus, disabled state, and reduced
   motion for the changed surface.
11. Run the skill validator, its Node focused tests, and the frontend
    design-system architecture check when UI source is affected.

## voco Button API rule

Application code uses the shared `voco` Button API, never Angular Material
button directives or legacy button classes directly:

- `VocoPrimaryButtonComponent` / `voco-primary-button` for the main action;
- `VocoSecondaryButtonComponent` / `voco-secondary-button` for a lower-emphasis alternative;
- `VocoSuccessButtonComponent`, `VocoWarningButtonComponent`, and
  `VocoErrorButtonComponent` with their matching `voco-*-button` selectors for
  outcome-specific actions;
- `VocoNavigationButtonComponent` / `voco-navigation-button` for imperative
  flow navigation;
- the corresponding `voco-*-link` component when native anchor behavior is
  required;
- `voco-icon-button` and `voco-audio-button` for icon-only and audio controls.

Handle a voco control's public action with `(activated)`. Do not bind feature
logic to the custom-element host's native `(click)` event.

Each semantic component is a distinct public class with a fixed intent and a
shared private foundation inside `ui/src/app/shared/voco-button/**`; Angular
Material remains a private implementation detail. Use native disabled behavior
for buttons. Disabled Voco links remove `href` and `routerLink`, expose
`aria-disabled="true"`, leave the tab order, and block mouse and keyboard
activation.

Square `voco-audio-button` controls are only for icon-oriented audio transport
and require an accessible name. Audio actions with visible text use a flexible
semantic text button. Feature CSS owns layout and placement only; Voco owns
button visuals. Selection controls remain native buttons and add
`vocoButtonInteraction` only for the shared Material ripple/focus layer when
CTA semantics would be incorrect.

Do not create feature-local Material overrides. Extend the shared component,
central design tokens, and this reference together. The architecture check
must reject direct Material Button imports/directives and the removed
`vocora-button` or `vocora-action-button` classes outside the shared
implementation.

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

The Python skill validator owns deterministic checks for:

- required skill structure and reference files;
- valid Design Tokens JSON;
- the exact canonical foundation palette and font token identities;
- complete light/dark semantic token parity;
- required CSS variable parity with the token source;
- required Material semantic mappings;
- documented six-intent button contract and native disabled rule;
- the documented UI primitive decision hierarchy;

The canonical Node check at
`ui/tests/test-design-system-architecture.mjs` exclusively owns frontend source
scanning for:

- single-owner framework theme and foundation color definitions;
- exact current legacy `!important` and feature Material-internal selector
  debt, plus base/head monotonicity;
- documented central framework integration exceptions;
- Angular inline styles and supported stylesheet formats, including `.sass`;
- the shared standalone-component ownership boundary.

### Codex-owned

Codex owns semantic visual judgment, including:

- hierarchy, density, composition, and responsive layout;
- whether an existing semantic token fits the requested meaning;
- readable foreground/background selection;
- appropriate mascot or illustration use;
- whether a genuinely new semantic extension is justified.
- whether light and dark variants preserve the same meaning and hierarchy.
- whether nearby legacy CSS can be safely replaced by an exact Bootstrap
  utility without creating unrelated churn.
- whether a new reusable product-specific primitive is a true shared concept
  rather than a false abstraction.

### No manual fallback

- Do not bypass deterministic validation.
- If either validator fails, fix its canonical source, mapping, baseline, or
  implementation; do not replace it with prose-only inspection or duplicate
  frontend scanning in the Python skill validator.

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
- `ui/tests/design-system-architecture-baseline.json` — frontend-owned exact
  current legacy specificity and Material-internal selector debt plus narrowly
  documented central integration exceptions.
