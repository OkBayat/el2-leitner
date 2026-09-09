# Runtime Exercise Contract

Load this reference after the exercise objective and evidence requirement are known. Repository source remains authoritative:

- `ui/src/app/domain/collection-learning-path/slide-sequence-exercise.ts` parses the sequence.
- `ui/src/app/shared/slide-exercise/slide-content-registry.ts` registers renderers and default chrome.
- `ui/src/app/shared/slide-exercise/library/slide-library.models.ts` defines reusable slide data.
- `back/src/domain/collection-learning-path/SlideSequenceExercise.js` validates definitions and completion evidence.

## Canonical envelope

Use application-owned camelCase field names:

```json
{
  "id": "stable-exercise-id",
  "type": "slides.sequence",
  "schemaVersion": 1,
  "completionPolicy": "slide-sequence",
  "config": {
    "slides": [
      {
        "id": "stable-slide-id",
        "type": "selection",
        "data": {
          "mode": "single",
          "question": "Choose one option.",
          "options": [
            { "id": "first", "label": "First option" },
            { "id": "second", "label": "Second option", "description": "Optional supporting detail." }
          ]
        }
      },
      {
        "id": "finish",
        "type": "summary",
        "terminal": true,
        "data": {},
        "chrome": {
          "header": { "visible": false },
          "footer": {
            "primary": { "id": "finish", "label": "Finish", "behavior": "emit" },
            "secondary": false
          }
        }
      }
    ]
  }
}
```

The sequence needs at least two slides, unique slide IDs, and exactly one terminal slide in the final position. The skill validator additionally requires that final slide to be `summary` so authored exercises follow one predictable completion pattern.

## Shared slide data

All reusable slides may declare `instruction`, `stimulus`, and `explanation` where the component supports them. Stimulus types are `text`, `audio`, `dialogue`, `image`, `chart`, and `diagram`; use their exact fields from `slide-library.models.ts`. Never invent an asset URL.

Options are objects with a stable `id`, visible `label`, and optional `description`. Answer fields use an `id`, one or more `answers`, and optional constraints such as `wordLimit`, `caseSensitive`, `punctuationSensitive`, or `exactSpelling`.

## Chrome and evidence

Registry defaults normally own buttons:

- scored slides use a disabled `Check` action until answerable;
- `selection` uses a disabled `Continue` action until at least one option is selected;
- speaking and writing use a disabled `Submit` action until answerable;
- presentation slides normally use shell navigation.

Use `chrome` only for deliberate changes such as a finish-only terminal summary. Scored slides emit `answered`; unscored decision and open-production slides emit `submitted`. A submitted event proves completion, not correctness.

## Selection versus choice

Use `selection` when the learner chooses a preference, path, category, or configuration and no option is correct. Set `mode` to `single` or `multiple`. It emits `selectedOptionIds` and must not contain `correctOptionId`, `correctOptionIds`, or `answers`.

## Dynamic selection expansion

Use dynamic expansion when a selection chooses the shape of a sequence but the
number or content of its activity slides comes from an authoritative runtime
query. Add an application-registered `expansionId` to the selection data:

```json
{
  "id": "practice-mode",
  "type": "selection",
  "data": {
    "mode": "single",
    "question": "Select a practice mode",
    "expansionId": "house-one-practice",
    "options": [
      { "id": "vocabulary-dictation", "label": "Vocabulary Dictation" },
      { "id": "sentence-completion", "label": "Sentence Completion" }
    ]
  }
}
```

The exercise JSON stores only this stable identifier. Never put a function,
Angular service, dependency-injection token, or preloaded runtime object in the
slide data. The owning application parent supplies `selectionExpansion` in the
runtime `ExerciseContext`. The selection sends `{ expansionId, slideId,
selectedOptionIds }` to that handler; the handler queries its source and returns
`{ slides }`. The selection then inserts those slides immediately after itself
through the parent deck controller and advances only after insertion succeeds.

Every returned slide must use a registered catalog type, have a unique stable
non-terminal ID, and be fully configured from authoritative source data. The
configured terminal `summary` remains last because the deck insertion contract
places generated slides before it. If the handler is absent, returns no slides,
cannot cover every required source item, or would need to invent content, keep
the selection open and report the failure. The handler and its source query are
application behavior and require focused application tests; the static exercise
validator only verifies the non-empty `expansionId` and JSON envelope.

For a persisted Learning Path exercise, use expansion only after the backend
completion owner can reconstruct and verify the generated slide set and its
answers. The current generic backend verifier does not infer arbitrary dynamic
slides from a frontend handler. A standalone parent may own completion locally,
as Practice Words does; otherwise stop instead of publishing unverifiable
completion evidence.

Use `choice` when options form an assessment question. Configure `correctOptionIds`; its result is graded by the backend.

## Validation boundary

`validate-exercise.py` checks deterministic structure and the minimum safe contract. It cannot establish factual correctness, distractor quality, teaching value, or source fidelity. Those remain agent-owned and must be reviewed against the supplied source while authoring.
