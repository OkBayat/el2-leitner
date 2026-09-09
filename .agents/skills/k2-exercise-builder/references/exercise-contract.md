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

Use `choice` when options form an assessment question. Configure `correctOptionIds`; its result is graded by the backend.

## Validation boundary

`validate-exercise.py` checks deterministic structure and the minimum safe contract. It cannot establish factual correctness, distractor quality, teaching value, or source fidelity. Those remain agent-owned and must be reviewed against the supplied source while authoring.
