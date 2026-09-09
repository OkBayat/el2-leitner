# Vocora Visual Design Reference

Vocora uses a playful classroom-on-white-paper visual language. The product
should feel friendly, rounded, focused, and readable: saturated color carries
meaning while body copy and most surfaces remain calm.

Light is the default theme. Dark is a first-class equivalent: it keeps the same
semantic roles and component geometry while using independently tuned surfaces,
text, controls, and feedback pairs.

## 1. Foundation palette

Only the following foundation colors may establish new product patterns:

| Token           |     Value | Role                                                        |
| --------------- | --------: | ----------------------------------------------------------- |
| Eager Green     | `#58CC02` | Success, progress, correct answers, large green accents     |
| Storybook Green | `#D7FFB8` | Soft highlight wash                                         |
| Spark Blue      | `#1CB0F6` | Primary CTA, links, and outlined secondary actions           |
| Fresh Leaf      | `#A5ED6E` | Supporting short green accents                              |
| Night Ink       | `#000437` | Deep violet emphasis                                        |
| Paper White     | `#FFFFFF` | Page canvas, surfaces, and text on strong fills             |
| Charcoal        | `#4B4B4B` | Headings and primary copy                                   |
| Pencil Gray     | `#777777` | Secondary copy                                              |
| Faded Gray      | `#AFAFAF` | Disabled content and control borders                        |

Vocora additionally defines two semantic feedback colors required by the
exercise domain:

- Attention Yellow `#FFC800` for warning actions.
- Answer Red `#FF4B4B` for incorrect-answer and destructive actions.

Do not introduce another raw UI color inside a feature. Extend the canonical
tokens first when a genuinely new semantic role is required.

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
| Success action | `#72D72B` |
| Secondary action text | `#49C0F8` |
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
| Warning   | `vocora-button--warning`   | Attention Yellow fill, Charcoal text                     | Caution or attention          |
| Secondary | `vocora-button--secondary` | Paper White fill, Spark Blue text, 2px Faded Gray border | Lower-emphasis alternative    |

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
parts of the control shape.

Button labels use the control type style: 15px, weight 700, and 0.053em
tracking. Uppercase is appropriate for short CTA labels, not explanatory copy.
Button height is content-driven with a 44px minimum, so translated or wrapped
labels cannot be clipped. The lower edge brings the normal visual footprint to
at least 48px.

### Disabled buttons

Use the native `disabled` attribute. Never encode disabled state with a visual
class alone.

- Filled intents: Faded Gray fill, Paper White label, and no border.
- Secondary intent: Paper White fill with Faded Gray label and 2px border.
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
- use blue for primary actions, links, and outlined secondary actions;
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
