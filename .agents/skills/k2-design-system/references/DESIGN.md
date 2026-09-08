# Vocora Visual Design Reference

This document is the human-readable source of truth for Vocora's visual language.

Vocora is designed for sustained language-learning sessions. The interface should reduce friction and visual fatigue while still feeling warm, recognizable, and motivating.

The guiding words are:

**Simple · Friendly · Focused**

## 1. Theme model

Vocora always has two complete themes:

- **Light** — the default theme.
- **Dark** — a first-class equivalent theme.

Every component, state, and semantic color must be designed for both themes in the same task. A light-only or dark-only implementation is incomplete.

Theme switching must change presentation, not meaning. Success remains success, disabled remains disabled, future remains future, and hierarchy must remain equivalent in both themes.

Do not build dark mode by mechanically inverting light colors.

## 2. Brand palette

The brand is anchored by the Vocora parrot mascot.

Core brand colors:

- Brand Green — primary mascot/body identity.
- Brand Mint — soft supporting surface/accent color.
- Brand Teal — deeper secondary brand color.
- Brand Orange — warm accent used by the mascot and selected highlights.

Canonical values live in `tokens.json`.

The brand palette is not a license to make the entire product green. Most product surfaces should remain neutral, with brand color used deliberately for hierarchy and identity.

## 3. Semantic colors

Feature code should consume semantic meaning, not raw color names.

Canonical semantic states include:

- primary;
- secondary;
- success;
- information;
- warning;
- error;
- mastered;
- leitner-active;
- not-started;
- future;
- disabled.

Examples:

- A mastered vocabulary item uses the `mastered` semantic state.
- A word currently in the Leitner system uses `leitner-active`.
- A word not yet entered into the Leitner system uses `not-started`.
- Future timeline activities use `future`.

Each semantic state must have explicit light and dark values.

## 4. Light theme

Light is the application default.

The light theme should use:

- a soft neutral page background;
- white or near-white surfaces;
- subtle borders;
- dark neutral text;
- restrained brand accents;
- clearly differentiated semantic states.

Avoid large fully saturated brand-colored page backgrounds for normal product screens.

## 5. Dark theme

Dark theme should be designed independently enough to preserve readability and hierarchy.

Use:

- deep green-neutral backgrounds rather than pure black;
- slightly lifted surfaces for cards/dialogs;
- light neutral text;
- softened but still recognizable brand accents;
- semantic colors tuned for contrast on dark surfaces.

Do not reuse light-theme foreground/background pairs blindly.

## 6. Neutral surfaces

The neutral palette should carry most of the interface.

Use neutrals for:

- page backgrounds;
- cards;
- separators;
- borders;
- secondary text;
- disabled surfaces;
- future/inactive timeline items when appropriate.

Brand colors should communicate hierarchy, identity, or state rather than decorate every container.

## 7. Typography

Vocora should continue using the repository's system font stack unless the product explicitly adopts another type family.

Recommended type scale:

- Display: 32 / 40 / 700
- H1: 28 / 36 / 700
- H2: 24 / 32 / 700
- H3: 20 / 28 / 650
- Title: 18 / 26 / 600
- Body: 16 / 24 / 400
- Body Small: 14 / 20 / 400
- Label: 14 / 20 / 600
- Caption: 12 / 18 / 500

Use strong weight sparingly. Do not fill cards with explanatory copy when the action or state is already self-explanatory.

## 8. Spacing

Use a 4px base spacing system.

Canonical spacing steps:

- 4px
- 8px
- 12px
- 16px
- 20px
- 24px
- 32px
- 40px
- 48px
- 64px

Typical use:

- small control gap: 8px;
- related content gap: 12px;
- mobile card padding: 16px;
- desktop card padding: 20–24px;
- section spacing: 24–32px.

Avoid arbitrary one-off spacing values unless there is a documented visual reason.

## 9. Radius

Vocora is rounded, but not every element should become a pill.

Canonical radii:

- xs: 8px
- sm: 10px
- md: 14px
- lg: 18px
- xl: 24px
- dialog: 28px
- pill: 999px

Typical use:

- inputs: 12–14px;
- buttons: 12–14px;
- cards: 16–18px;
- large panels: 20–24px;
- dialogs: 28px;
- chips: pill.

## 10. Elevation and shadows

Vocora should remain visually flat.

Default card treatment:

- border or tonal separation;
- no shadow unless elevation has interaction meaning.

Use light elevation only for:

- dialogs;
- floating overlays;
- popovers;
- temporarily raised interactive surfaces.

Avoid heavy shadows on routine cards and lists.

## 11. Buttons

Use hierarchy rather than visual noise.

### Primary button

Use for the main action of the current interaction, such as:

- Start
- Continue
- Submit

Use the shared Angular Material filled-button pattern. Its raised edge may use
the semantic primary-edge token, but the control must remain flat at rest and
must not introduce feature-local colors.

### Secondary button

Use for a valid alternative action with lower emphasis.

### Tertiary/text button

Use for low-emphasis actions.

Icon-only controls should maintain an interaction target of at least 44 x 44 CSS pixels where practical.
Use Angular Material icon buttons for standalone icon actions and provide an
accessible name when no visible label is present.

Primary-action text/background contrast must be validated independently in both themes.

## 12. Cards

A card should usually have:

- one clear purpose;
- one title;
- limited metadata;
- a clear action or state.

Avoid:

- deep card nesting;
- redundant explanatory text;
- decorative multi-color treatments;
- combining border, strong shadow, and colored background without a functional reason.

## 13. Chips and badges

Use chips for compact state labels such as:

- Easy
- Intermediate
- Hard
- Mastered
- Active
- New

Do not use chips for long explanations.

Chip colors must come from semantic tokens and work in both themes.

## 14. Icons

Use one consistent icon language.

- Do not use emoji as routine UI icons.
- Avoid decorative icons that add no meaning.
- Use icon-only controls only where the meaning is recognizable.
- Keep the clickable area larger than the glyph when needed for accessibility.

## 15. Mascot

The Vocora parrot is a brand asset.

Good uses:

- onboarding;
- selected empty states;
- meaningful achievements;
- PWA install surfaces;
- streak/milestone feedback;
- selected branded loading states.

Avoid repetitive mascot decoration in:

- tables;
- repeated list rows;
- dense exercise cards;
- every panel or button.

The mascot should remain special enough to reinforce identity when it appears.

## 16. Logo

The canonical Vocora logo direction is a close-up of the mascot face with:

- large expressive eyes;
- green face/background family;
- mint details;
- teal details;
- orange beak accent.

Do not invent per-feature recolored logos unless explicitly requested.

## 17. Timeline and home states

The daily home timeline must communicate time and completion status clearly.

Rules:

- Completed historical activities may use their semantic activity color.
- Future activities are always visually inactive using the `future` semantic state.
- On the current day, completed activities are active/colored.
- On the current day, incomplete activities remain visually inactive.
- Unavailable or disabled activities use the `disabled` semantic state.

Color should communicate actual state, not decorate the path.

### Activity accent families

Use semantic accents sparingly for quick recognition:

- Vocabulary — green family
- Listening — blue family
- Shadowing — teal family
- Reading — purple family
- Writing — orange family
- Grammar — indigo family

Use these accents mainly for icons, nodes, small badges, and progress indicators. Do not fill every activity card with a saturated category color.

Each accent must have a light-theme and dark-theme value.

## 18. Forms

Forms should be calm and predictable.

- Keep labels visible and readable.
- Preserve clear focus, error, disabled, and success states in both themes.
- Do not rely on placeholder text as the only label.
- Do not use color alone to communicate validation failure.
- Use semantic tokens for field borders, focus rings, and validation states.

Selected answer options use the information surface and border tokens. Their
compact marker uses the information foreground token while the answer label
keeps the primary text color for reading contrast.

## 19. Tables and dense data

Tables should prioritize readability over decoration.

- Use restrained borders and row separation.
- Avoid highly saturated row backgrounds.
- Use chips/badges for semantic status where appropriate.
- Provide responsive behavior for small screens rather than forcing desktop density into mobile.

## 20. Motion

Canonical motion durations:

- fast: 120ms
- normal: 180ms
- slow: 240ms

Typical use:

- hover/press feedback: fast;
- button state transitions: fast;
- popovers/dialogs: normal;
- page-level transitions: slow.

Avoid continuous bounce, pulse, or attention-seeking motion in study flows.

Respect `prefers-reduced-motion`.

## 21. Responsive behavior

Design mobile first.

- Keep the current minimum viewport support.
- Avoid horizontal overflow.
- Keep important actions reachable.
- Reduce low-value metadata before shrinking text below readable sizes.
- Allow layouts to become single-column on narrow screens.
- Provide responsive alternatives for dense tables and action groups.

## 22. PWA surfaces

PWA visuals are part of the same design system.

Use Vocora theme tokens for:

- theme color;
- splash/background surfaces;
- install prompt styling;
- loading screens;
- standalone app background;
- system-bar-compatible surfaces when controlled by the application.

Respect mobile safe-area insets.

Both light and dark PWA surfaces must be designed when a PWA visual changes. Light remains the default.

## 23. Accessibility

For both themes:

- meet WCAG AA contrast for normal text and interactive controls where applicable;
- keep visible focus indicators;
- use text/icon/shape support when state cannot safely rely on color alone;
- preserve readable disabled states;
- target at least 44 x 44 CSS pixels for touch controls where practical;
- maintain meaningful hover, focus, pressed, selected, and disabled states.

## 24. Do / Don't

### Do

- use tokens;
- design light and dark together;
- keep light as the default;
- prefer semantic colors;
- keep the interface simple;
- maintain strong hierarchy;
- use whitespace intentionally;
- design mobile first;
- validate accessibility in both themes.

### Don't

- invent page-specific palettes;
- hard-code raw feature colors when tokens should exist;
- make every surface green;
- overuse the mascot;
- add heavy shadows;
- add gradients without a clear brand/product reason;
- make the app look like an enterprise dashboard;
- copy another product pixel-for-pixel;
- ship a visual change with only one theme designed.
