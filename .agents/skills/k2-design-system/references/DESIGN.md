# Vocora Visual Design Reference

Vocora uses a playful classroom-on-white-paper visual language. The product
should feel friendly, rounded, focused, and readable: saturated color carries
meaning while body copy and most surfaces remain calm.

Light is the default theme. Dark is a first-class equivalent: it keeps the same
semantic roles and component geometry while using independently tuned surfaces,
text, controls, and feedback pairs.

## UI implementation architecture

Use this decision tree for every product-facing UI change:

```text
Need UI?
|
+-- Existing Vocora shared primitive? -> use it
|
+-- Standard interactive primitive in Angular Material? -> use Material
|
+-- Required behavior available in Angular CDK? -> build a shared Vocora primitive on CDK
|
+-- Reusable product-specific primitive? -> build it in ui/src/app/shared on Material and/or CDK
|
+-- Layout, spacing, display, or semantic utility in Bootstrap? -> use the Bootstrap utility
|
+-- Existing shared style or semantic token? -> use it
|
+-- Otherwise -> add the minimal custom implementation and record why it is needed
```

Material wins over assembling the same higher-level control from CDK pieces.
Bootstrap utilities and semantic tokens still style the layout around a
Material, CDK, or shared component; they are not competing component systems.

### Vocora shared primitives

An existing reusable Vocora component or design-system primitive is the first
choice. Feature code must not bypass it with a parallel implementation. One UI
concept has one shared owner.

New reusable product-specific primitives belong under `ui/src/app/shared`, not
inside a feature folder. They use Material and/or CDK foundations when those
foundations apply, keep domain behavior outside the presentation primitive, and
expose a small, semantic, typed, stable API. Feature components compose shared
primitives instead of cloning them. If two or more features need substantially
the same low-level UI behavior, consolidate it unless that would create a false
abstraction. Do not introduce a giant legacy-style `SharedModule`; preserve the
application's standalone component/import architecture.

This shared ownership includes reusable dialog shells, action primitives,
drag/drop behavior, menus, focus management, and other low-level interactions.
Future product component names use the `Voco` family and `voco-*` selectors,
for example `VocoButtonComponent` and `voco-button`. The governance contract
does not itself introduce a Voco Button; that implementation belongs to
dedicated component work.

### Angular Material

When no Vocora primitive exists, use Angular Material for a suitable standard
interactive component, including dialogs, menus, form fields, inputs, selects,
checkboxes, radio buttons, tabs, tooltips, snackbars, and progress indicators.
Do not hand-roll equivalent interaction or accessibility semantics with raw
HTML, CSS, or JavaScript. Material owns the interaction primitive and its
accessibility behavior; Vocora owns product styling and semantic tokens.

### Angular CDK

When Material has no appropriate visual component but Angular CDK provides the
needed behavior, build the reusable Vocora component on that CDK primitive.
Use CDK DragDrop, Overlay, A11y, Portal, and scrolling infrastructure where
appropriate instead of homemade DOM listeners, absolute-positioning systems,
focus traps, portals, or duplicated interaction logic.

### Bootstrap utilities

Bootstrap is Vocora's utility and layout layer. Prefer an exact built-in
utility for common display, grid, flex, alignment, wrapping, spacing, sizing,
visibility, text alignment, borders, and semantically correct color roles.
Examples include `d-flex`, `d-grid`, `justify-content-*`, `align-items-*`,
`flex-column`, `flex-wrap`, `m-*`, `p-*`, `gap-*`, `w-100`, `h-100`,
`text-primary`, `bg-success`, and `border-danger`.

Do not write component CSS for `display: flex`, `justify-content: center`, a
standard spacing increment, or `width: 100%` when the corresponding Bootstrap
utility expresses the exact requirement. Do not force an approximate utility
when the design requires a different value.

Bootstrap is not Vocora's interactive component library. Do not introduce
Bootstrap JavaScript widgets or Bootstrap buttons, modals, or dropdowns in
place of Vocora, Material, or CDK components.

## Touch-to-refactor

Whenever an existing component, template, or style file changes, inspect the
portion being touched. If nearby legacy CSS duplicates an obvious exact
Bootstrap utility, move that presentation to the template utility and remove
the now-unused declaration. Do not add new custom declarations beside an
equivalent legacy declaration.

This is progressive, owner-local cleanup. Do not create unrelated
repository-wide churn, force approximate utility substitutions, or distort
component geometry, animation, pseudo-elements, and genuinely custom visual
behavior merely to avoid CSS.

## Custom CSS last

Before adding custom CSS, check in this order:

1. Is there an existing Vocora shared component or shared style?
2. Does Angular Material provide the component interaction?
3. Does Angular CDK provide the required behavior?
4. Is this a reusable product-specific primitive that belongs under
   `ui/src/app/shared` and should compose Material and/or CDK?
5. Does Bootstrap provide the exact utility?
6. Does an existing Vocora semantic token or shared pattern represent it?

Only then add the minimal custom CSS. The declaration must have a concrete
component-specific reason to exist.

## Theme and color ownership

- Vocora semantic tokens own product colors and semantic visual roles.
- `ui/src/styles/_angular-material-theme.scss` maps Material system semantics
  to Vocora tokens.
- `ui/src/styles/_bootstrap-theme.scss` maps Bootstrap semantic utilities to
  Vocora tokens.
- Feature and component SCSS consumes semantic tokens, framework utilities,
  and shared patterns; it does not create an alternative global palette.

Do not redefine Bootstrap semantic variables or Material system colors in a
feature, hard-code copies of design-system palette colors, or create a one-off
semantic color system. The same semantic role across Material and Bootstrap
must resolve to the same Vocora meaning.

### Three token layers

The runtime source of truth is
`ui/src/styles/_vocora-design-system.scss`. It has two explicit sections:

1. **Foundation tokens** own every raw palette value, type family, spacing,
   radius, and motion value.
2. **Vocora semantic tokens** assign product meaning for light and dark themes.

The runtime file is included before both Layer C adapters. The Bootstrap and
Angular Material adapters reference only Vocora semantic tokens; neither owns
a palette. `references/tokens.json` is the resolved machine-readable semantic
contract, and runtime parity for every listed role is enforced by the frontend
theme contract test.
`references/variables.scss` and `references/material-theme.scss` are
non-normative implementation examples whose required roles are validated;
they are not complete mirrors or independent runtime inputs.

ThemeService owns theme changes and writes one root `data-theme` value. The
early paint bootstrap resolves that same stored mode before Angular starts.
Both adapters follow the semantic custom properties under that root state; do
not add `data-bs-theme`, a Material theme service, or another observable.
The bootstrap and static theme-color metadata may carry raw page-color
fallbacks only for the pre-CSS paint window. These values are synchronized
from the Layer A page colors by `ui/tools/sync-first-paint-theme-colors.mjs`;
build and test validation fails when an artifact is stale, so bootstrap code,
HTML metadata, manifests, and tests never become palette owners. Once Angular
applies a theme, ThemeService clears the bootstrap's inline background and
derives system chrome from the computed `--vocora-surface-page` role.

Branded share-image exports consume the `--vocora-share-story-*` semantic
roles. Their palette intentionally remains stable across the application
themes, but its raw values still belong exclusively to Layer A.

### Semantic equivalence

| Vocora role | Bootstrap public role | Material system role |
| --- | --- | --- |
| Primary | `--bs-primary`; `bg-primary`, `text-primary`, `border-primary` | `--mat-sys-primary` |
| Secondary | `--bs-secondary`; `bg-secondary`, `text-secondary`, `border-secondary` | `--mat-sys-secondary` |
| Success | `--bs-success`; `bg-success`, `text-success`, `border-success` | Product success tokens; no Material system success role |
| Information | `--bs-info`; `bg-info`, `text-info`, `border-info` | `--mat-sys-tertiary` |
| Warning | `--bs-warning`; `bg-warning`, `text-warning`, `border-warning` | Product warning tokens; no Material system warning role |
| Error | `--bs-danger`; `bg-danger`, `text-danger`, `border-danger` | `--mat-sys-error` |
| Page surface | `--bs-body-bg` | `--mat-sys-surface`, `--mat-sys-background` |
| Raised surface | `--bs-tertiary-bg` | `--mat-sys-surface-container` |
| Subtle surface | `--bs-secondary-bg`, `--bs-light` | `--mat-sys-surface-container-high` |
| Primary text | `--bs-body-color` | `--mat-sys-on-surface` |
| Muted text | `--bs-secondary-color` | `--mat-sys-on-surface-variant` |
| Default border | `--bs-border-color`; `border` | `--mat-sys-outline` |
| Subtle border | `--bs-border-color-translucent` | `--mat-sys-outline-variant` |
| Inverse primary | Product inverse action treatment | `--mat-sys-inverse-primary` |
| Focus | `--bs-focus-ring-color`, derived from `--vocora-focus-ring` | Product focus treatment |

Bootstrap `secondary` means the real Vocora secondary emphasis role. Muted
copy maps through Bootstrap's separate `--bs-secondary-color` body role, so
framework terminology cannot collapse two product meanings. Material has no
native success or warning system roles; shared product components consume the
Vocora roles directly instead of misusing another Material color slot.

## Specificity and `!important`

Do not solve theme or component conflicts by escalating selector specificity,
adding wrapper after wrapper, scattering framework internals through features,
or adding application-owned `!important` declarations. New `!important` is
prohibited by default.

If an upstream constraint makes `!important` genuinely unavoidable, first
verify that the framework's supported token or theme API cannot solve it. Keep
the exception in the single relevant integration boundary and document both
its reason and upstream constraint in the dedicated integration-exception
section. Never edit Bootstrap's generated or internal CSS.

`ui/tests/test-design-system-architecture.mjs` is the canonical frontend source
guardrail. It scans CSS, Less, SCSS, indented Sass, and Angular inline `styles`
in literal scalar or literal array form; unsupported expressions fail closed.
It requires actual legacy debt to equal the declared baseline in
`ui/tests/design-system-architecture-baseline.json`, so stale
entries fail and must be removed with the source debt. It also compares each
legacy entry with the pull request base source: legacy debt may stay the same
or shrink, but an ordinary change cannot add a new occurrence and bless it as
legacy. A genuinely unavoidable new framework exception uses the separate
integration-boundary section, which is restricted to canonical framework
owners and requires an explicit upstream constraint. This is not permission
for feature or application-owned exceptions.

## Angular Material internals

Feature code must not target undocumented implementation selectors such as
`.mat-mdc-*` for visual redesign. Use the official Material theming or token API
first. If that cannot express a product-level customization, keep the override
in the single centralized Vocora Material integration layer. Never scatter
Material-internal selectors through feature SCSS.

## 1. Foundation palette

Only the following foundation colors may establish new product patterns:

| Token           |     Value | Role                                                        |
| --------------- | --------: | ----------------------------------------------------------- |
| Eager Green     | `#58CC02` | Success, progress, correct answers, large green accents     |
| Storybook Green | `#D7FFB8` | Soft success-state wash                                     |
| Spark Blue      | `#1CB0F6` | Primary CTA and links                                        |
| Fresh Leaf      | `#A5ED6E` | Supporting short green accents                              |
| Night Ink       | `#000437` | Light-theme secondary emphasis                              |
| Paper White     | `#FFFFFF` | Page canvas, surfaces, and text on strong fills             |
| Charcoal        | `#4B4B4B` | Headings and primary copy                                   |
| Pencil Gray     | `#777777` | Secondary copy                                              |
| Faded Gray      | `#AFAFAF` | Disabled content and control borders                        |
| Button Disabled Gray | `#D9D9D9` | Disabled button faces and secondary labels              |
| Button Border Gray | `#E5E5E5` | Secondary button borders                                   |
| Mist             | `#F1F5F2` | Neutral subtle surfaces                                      |
| Soft Border      | `#E4EAE6` | Light-theme subtle borders                                   |

Vocora additionally defines two semantic feedback colors required by the
exercise domain:

- Attention Yellow `#FFC800` for warning actions.
- Answer Red `#FF4B4B` for incorrect-answer and destructive actions.

Do not introduce another raw UI color inside a feature. Extend the canonical
tokens first when a genuinely new semantic role is required.

`ui/tests/test-design-system-architecture.mjs` enforces this boundary across
stylesheets and Angular inline styles, and also rejects feature-owned
`data-theme` selectors. PWA styling references the Layer A page-color token;
no stylesheet outside Layer A owns a raw page color. External-brand and
illustration colors still live in Layer A; consumers reference their foundation
or theme-aware illustration roles rather than copying values.

### Dark-theme semantic palette

The supplied foundation establishes the light-theme identity. Dark mode adapts
that identity rather than inverting it:

| Role | Dark value |
|---|---:|
| Page | `#0F1611` |
| Surface | `#161F19` |
| Raised surface | `#1D2921` |
| Subtle surface | `#223027` |
| Border | `#536159` |
| Primary text | `#F0F7F2` |
| Secondary text | `#A9B8AD` |
| Primary action | `#49C0F8` |
| Secondary semantic | `#A98BFF` |
| Success action | `#72D72B` |
| Secondary action surface | `#FFFFFF` |
| Secondary action text | `#4B4B4B` |
| Warning action | `#FFC45A` |
| Error action | `#FF6B6B` |

Every new semantic visual token must be added to both theme branches in the
same change. Light remains the default.

## 2. Typography

Use `duolingo-sans` for body copy, controls, navigation, and subheadings. When
the family is unavailable, fall back in this order: Inter, Nunito Sans, then
the system sans stack.

Use `feather` only for display headlines at 48px or larger. Feather Bold or
Nunito Black is the fallback. Never use the display family for controls or body
copy.

| Role          |    Size | Line height | Weight |         Letter spacing |
| ------------- | ------: | ----------: | -----: | ---------------------: |
| Caption       |    13px |        1.23 |    500 |                 normal |
| Control       | 14–15px |        1.33 |    700 | 0.053em when uppercase |
| Body          |    17px |        1.18 |    500 |                 normal |
| Subheading    |    19px |        1.40 |    700 |                 normal |
| Small heading |    32px |        1.20 |    700 |                 normal |
| Heading       |    48px |        1.20 |    700 |               -0.020em |
| Display       |    64px |        1.20 |    700 |               -0.020em |

Body copy uses Pencil Gray by default. Hero headings use Charcoal. Colored text
is reserved for short interactive or emphasized content.

## 3. Spacing and layout

- Base spacing unit: 4px.
- Density: comfortable.
- Maximum content width: 1200px.
- Section gap: 80–120px.
- Card padding: 16–24px.
- Related element gap: 12px.
- Textual buttons use a 13px radius; links and navigation items use 12px.
- Interactive targets remain at least 44 x 44 CSS pixels.

Prefer generous whitespace and focused single-purpose regions. Avoid dense
enterprise-dashboard composition, deep card nesting, and decorative grids.

## 4. Material button system

Textual Angular Material buttons are chunky, rounded controls with a 44px face,
a 13px radius, and a 4px lower edge. They never use gradients or ambient
elevation; the lower edge is their only depth cue.

Every styled Angular Material button uses the base class `vocora-button` and
exactly one intent class:

| Intent    | Class                      | Treatment                                                | Use                           |
| --------- | -------------------------- | -------------------------------------------------------- | ----------------------------- |
| Primary   | `vocora-button--primary`   | Spark Blue fill, Paper White text                        | The one main action           |
| Success   | `vocora-button--success`   | Eager Green fill, Paper White text                       | Confirmed/correct outcome     |
| Error     | `vocora-button--error`     | Answer Red fill, Paper White text                        | Incorrect/destructive outcome |
| Warning   | `vocora-button--warning`   | Attention Yellow fill, Paper White text                  | Caution or attention          |
| Secondary | `vocora-button--secondary` | Paper White fill, Charcoal text, 2px `#E5E5E5` border   | Lower-emphasis alternative    |

Example:

```html
<button mat-flat-button class="vocora-button vocora-button--primary">
  Continue
</button>
```

Use `mat-flat-button` for primary, success, error, and warning intents. Use
`mat-stroked-button` for secondary intent. The central override also keeps the
visual contract deterministic if a supported Material directive is changed.
Filled buttons are borderless. Secondary buttons use a 2px border around the
face in addition to the 4px lower edge; the border and lower edge are separate
parts of the control shape. Secondary labels use Charcoal (`#4B4B4B`) in both
themes. Dark mode preserves the Paper White secondary surface so this fixed
foreground remains readable.

Button labels use the control type style: 15px, weight 700, and 0.053em
tracking. Uppercase is appropriate for short CTA labels, not explanatory copy.
Button height is content-driven with a 44px minimum, so translated or wrapped
labels cannot be clipped. The lower edge brings the normal visual footprint to
at least 48px.

### Disabled buttons

Use the native `disabled` attribute. Never encode disabled state with a visual
class alone.

- Light filled intents: `#D9D9D9` fill, Pencil Gray (`#777777`) label, and no border.
- Light secondary intent: Paper White fill with `#D9D9D9` label and a 2px `#E5E5E5` border.
- Disabled buttons have no lower edge or hover/pressed response and sit 4px
  lower inside the preserved footprint.
- The cursor and Material disabled semantics remain intact.

Dark buttons use the dark action values in `tokens.json`; intent, hierarchy,
radius, typography, content-driven height, and native disabled behavior remain
identical to light mode.

### Interaction

- Textual Material buttons use `transition: none`. Pressing removes the lower
  edge and translates the face down by 4px immediately; releasing restores the
  complete visual state immediately. This central override is authoritative
  over Material and feature-level button transitions.
- Hover and pressed feedback must use Material state layers or a derived mix of
  the existing intent color; do not add a new raw color.
- Keyboard focus remains visible with a high-contrast outline.
- State meaning must not rely on color alone; the label and surrounding feedback
  identify success, warning, or error.

The legacy `vocora-action-button` class remains a compatibility consumer of
the same central base pattern for slide exercise actions. New reusable controls
use `vocora-button` plus an explicit intent.

## 5. Forms and selection controls

Forms remain calm and predictable. Keep visible labels, readable validation
copy, a clear focus state, and native disabled semantics.

Choice and selection controls are not CTA buttons. Their height stays
content-driven so multi-line labels remain readable; do not apply
`vocora-button` to answer-option tiles.

## 6. Surfaces and cards

Paper White is the page and card canvas. Storybook Green is a soft highlight,
not a default card fill. Prefer border or tonal separation over shadow.

Cards have one purpose, limited metadata, and one clear action or state. Do not
combine strong fill, border, and shadow on routine content.

## 7. Icons and imagery

Use thick, rounded icon strokes that fit the mascot-led language. Do not use
emoji as routine UI icons.

Illustrations may use broader mascot colors, but those colors do not become UI
chrome tokens. Place character art on open white surfaces rather than inside
decorative containers. Photography is not the default visual language.

## 8. Motion

Interaction motion is short and functional. Do not use continuous bounce,
pulse, or attention-seeking animation in study flows. Respect
`prefers-reduced-motion`.

## 9. Responsive behavior

Design mobile first. Avoid horizontal overflow, preserve readable labels, keep
primary actions reachable, and allow dense layouts to collapse to one column.
Reduce nonessential metadata before reducing type below the canonical scale.

## 10. Accessibility

- Preserve keyboard focus and native disabled semantics.
- Keep interactive targets at least 44 x 44 CSS pixels.
- Do not use color as the only carrier of a critical state.
- Keep labels available to assistive technology.
- Validate readable foreground/background pairing in the actual control state.
- Validate every changed component in light and dark themes.

## 11. Do and do not

Do:

- use the canonical tokens;
- keep surfaces white and typography calm;
- reserve green for success/progress/correct emphasis;
- use blue for primary actions and links;
- use Charcoal for secondary-button labels in both themes;
- use rounded 12px interactive shapes;
- compose Angular Material primitives.

Do not:

- introduce gradients, glass effects, or button shadows other than the
  canonical 4px lower edge;
- use sharp control corners;
- apply display type below 48px;
- color routine body paragraphs;
- apply CTA styling to answer-option tiles;
- invent feature-local palettes or Material overrides.
