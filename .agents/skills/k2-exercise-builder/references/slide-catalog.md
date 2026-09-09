# Registered Slide Catalog

Select a slide from the learner action and evidence required. The 17 reusable families below are registered by the application. `message` and `summary` are flow-shell types, not reusable interaction families.

| Type | Learner action and evidence | Essential data | Important boundary |
| --- | --- | --- | --- |
| `teaching-card` | Read a word, contrast, rule, warning, or tip | `mode`, `title`, `blocks[]` with `kind` and `content` | Presentation only; no mastery evidence. |
| `selection` | Choose one or several unscored preferences, paths, or settings | `mode: single|multiple`, `question`, at least two `options`; optional registered `expansionId` | No correct answer or scoring fields. Emits selected IDs. A dynamic expansion must be handled outside JSON by the owning application parent. |
| `choice` | Recognize one or several correct alternatives | `question`, `options`, `correctOptionIds`; optional recognition `mode` and `speech` | Options cue the answer; use recall slides when cues are inappropriate. |
| `truth` | Judge a statement | `mode`, `statement`, `correctOptionId`; optional `options` | Use not-given modes only when the source supports absence as evidence. |
| `matching` | Map related items | `pairs` with `id`, `left`, `right`; optional mode and feedback policy | Allow many-to-one only when the relation permits it. |
| `classification` | Assign items to explicit categories | at least two `categories`; `items` with `correctCategoryId` | Categories must be meaningful and item answers must reference them. |
| `ordering` | Reconstruct one defensible order | `items`, `correctOrderIds` | Do not use for relationships with several valid orders. |
| `cloze` | Fill gaps in meaningful context | `content`, `blanks`; optional `inputMode` and `wordBank` | Free text gives less support than word-bank or select modes. |
| `structured-completion` | Complete a form, table, notes, flowchart, or timeline | `layout`, `fields`; optional `columns` and `rows` | Preserve structure when layout carries meaning. |
| `short-answer` | Retrieve one brief answer without options | `question`, `answers`; optional hints and exact spelling | Hints reduce retrieval difficulty. |
| `word-formation` | Produce a derived form from a base | `baseWord`, `fields` with `partOfSpeech`; optional mode | Use matching when production is not required. |
| `error-correction` | Detect and replace faulty language | `original`, `answers`; optional mode and category | Accepted answers must not reject other valid corrections accidentally. |
| `rewrite` | Transform a supplied utterance | `original`; accepted answers, required fragments, target words, or model answer as appropriate | Open rewrites are submitted work unless deterministic constraints exist. |
| `pronunciation` | Discriminate or repeat a spoken form | `mode`, `question`; optional word, options, and correct option | Repeat is practice, not automatic pronunciation-quality judgment. |
| `dictation` | Convert heard language into written form | `answer` and exactly one `audio` or `speech`; optional mode and constraints | Tests sound-to-form production, not broad comprehension. |
| `speaking-response` | Record an oral response | `mode`, `prompt`; optional bullets, timing, vocabulary, notes | Submission proves a recording exists; semantic evaluation is separate. |
| `writing-response` | Compose an extended written response | `mode`, `prompt`; optional timer, word target, vocabulary, model, register | Submission and word count do not prove semantic mastery. |

## Flow-shell types

- `message`: show non-interactive sequence content when a teaching card is not needed. It carries no mastery evidence.
- `summary`: end the exercise and emit its outcome. The final slide must be the only `terminal: true` slide. Configure chrome to show only Finish when no summary content is desired.

## Common compositions

- Unscored setup: `selection` -> activity slides -> `summary`; the activity slides may be inserted at runtime through a registered `expansionId` when their complete source set is known only after selection.
- Vocabulary form practice: `pronunciation` -> `dictation` -> `summary`.
- Meaning into recall: `teaching-card` -> `choice` or `matching` -> `cloze` or `short-answer` -> `summary`.
- Usage repair: `teaching-card` -> `error-correction` -> `rewrite` -> `summary`.
- Productive transfer: supported recall slides -> `speaking-response` or `writing-response` -> `summary`.

Compositions are examples, not mandatory templates. Every slide must be justified by the active objective and source.

## Unsupported capability rule

Do not create a new slide, component, or type from this workflow. If none of the entries above expresses the required interaction and evidence semantics, stop and report:

1. the required learner action;
2. the required evidence;
3. the closest existing types considered;
4. why each is semantically insufficient;
5. the missing reusable capability that would need separate product authorization.
