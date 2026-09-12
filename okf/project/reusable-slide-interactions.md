---
type: Concept
title: Reusable Slide Interactions
description: Select and compose Vocora reusable slide families by learner action, evidence type, and assessment boundary.
tags: [learning-path, slides, exercises, angular, interaction-design]
timestamp: 2026-09-12T00:00:00Z
---

Vocora provides 19 reusable interaction families for lesson exercises. Select a
family from the action the learner must perform and the evidence the exercise
needs. A lesson topic such as collocations or word formation does not by itself
determine the interaction: the same content can require recognition, controlled
recall, correction, transformation, or independent production.

# Interaction Families

| Family | Best used for | Supported modes | Useful stimuli and combinations | Limits and cautions |
| --- | --- | --- | --- | --- |
| `teaching-card` | Presenting a word, usage distinction, rule, warning, or study tip before practice | `word`, `usage`, `contrast`, `rule`, `warning`, `tip`; constrained Markdown is preferred and legacy typed blocks remain readable | Markdown paragraphs, line breaks, level-three/four headings, emphasis, and short ordered or bullet lists; text, image, chart, or diagram stimuli remain available | Configure exactly one content format. Raw HTML is escaped. It presents information and does not prove mastery. |
| `selection` | Choosing a learner preference, path, category, or configuration when no option is correct | `single`, `multiple` | A question with two or more object-configured options; each option has an ID, label, and optional description. A registered `expansionId` can request runtime-sized follow-up slides. | It emits selected option IDs as submitted evidence. It is not scored and must not contain correctness fields. Dynamic handlers live in the application runtime, never in JSON. Use `choice` for assessment. |
| `number-input` | Choosing one bounded numeric setting when no numeric answer is being assessed | finite `min`, `max`, `step`, and `initialValue` | A labeled numeric control; a registered `expansionId` can request runtime-sized follow-up slides | It emits one validated number as submitted evidence. It is a setup decision, not a scored mathematics answer. |
| `choice` | Recognition among explicit alternatives | `single`, `multiple`, `meaning`, `part-of-speech`, `synonym`, `antonym`, `correct-spelling`, `best-word`, `odd-one-out` | Text or visual prompts; speech playback supports sound-to-option recognition | Options can cue the answer, so use constructed response when unaided recall is required. |
| `truth` | Judging a statement against a source, claim, or opinion | `true-false`, `true-false-not-given`, `yes-no-not-given`, `agree-disagree` | Text, audio, chart, or diagram followed by one or more judgments | Use `not-given` only when source coverage genuinely makes absence distinguishable from falsehood. |
| `matching` | Mapping two sets of related items | `definition`, `synonym`, `antonym`, `collocation`, `word-family`, `person-opinion`, `sentence-ending`, `heading-section`, `term-example` | Text sections, audio speakers, or term/example sets; can follow a teaching card | Prefer `on-complete` feedback for test-like tasks and `immediate` feedback for guided practice. Enable many-to-one only when the domain relation permits it. |
| `classification` | Assigning items to meaningful categories | `positive-negative`, `formal-informal`, `countable-uncountable`, `part-of-speech`, `possible-impossible`, `linking-word-function`, `letter-language-function`, `sound`, `custom` | Word lists, sentences, audio examples, or source-derived categories | Categories must be mutually understandable from the instruction. Do not force continuous or ambiguous distinctions into discrete buckets. |
| `ordering` | Reconstructing one or more explicitly defensible orders | `sequence`, `chronology`, `severity`, `adjective-order`, `process` | Processes, timelines, graded intensity, or language-order rules; `acceptedOrders` can preserve source-supported alternatives | Every accepted order must contain every item exactly once and include the primary key. Ordinary grouping or association belongs in matching or classification. |
| `labeling` | Connecting answers to marked spatial positions | `map`, `plan`, `diagram`; input modes `text`, `word-bank` | One shared image or diagram stimulus with positioned targets and accessible answer fields | Use only when spatial location is evidence. Every marker needs 0-100 percentage coordinates, accessible text, and server-owned accepted answers. |
| `cloze` | Controlled recall inside meaningful context | input modes: `text`, `word-bank`, `select` | Text or audio context; useful after recognition practice | `word-bank` and `select` provide stronger cues than free text. Configure accepted answers, word limits, case, punctuation, and spelling deliberately. |
| `structured-completion` | Preserving multi-field source structure while collecting answers | `form`, `table`, `notes`, `flowchart`, `timeline` | Listening/reading forms, tables, notes, processes, and timelines | Keep related fields together when their layout carries meaning. Do not fragment an authentic form or table into unrelated short-answer slides. |
| `short-answer` | Brief unaided retrieval of one answer | no mode; optional first-letter and character-count hints, plus a separate supporting-evidence prompt | Text, audio, image, chart, or diagram questions | `evidenceRequired` can require a cited span or explanation without merging it into the scored answer. Hints reduce retrieval difficulty. Use exact spelling only when orthographic accuracy is part of the objective. |
| `word-formation` | Producing a derived form from a supplied base word | `family`, `target-part-of-speech`, `prefix`, `suffix`, `negative-form`, `base-word`, `transitive-intransitive` | Sentential context or a teaching card showing a word family | This tests production of form, not recognition of a word-family relation. Use matching when production is not required. |
| `error-correction` | Detecting and replacing faulty language | `select-and-replace`, `inline-edit`, `sentence-correction`, `paragraph-correction` | Sentences or paragraphs containing a purposeful error; often follows a rule card | Accepted corrections must reflect the intended error category and avoid rejecting other valid rewrites accidentally. |
| `rewrite` | Transforming meaning, register, grammar, or target vocabulary | `paraphrase`, `target-grammar`, `target-vocabulary`, `sentence-transformation`, `noun-to-verb`, `verb-to-noun`, `formalize`, `linking-word`, `synonym-replacement` | Source sentence plus targets; useful before independent writing | Exact accepted answers or required fragments can score constrained tasks. Open transformations should provide a model answer and be treated as submitted work rather than pretending to have exhaustive automatic scoring. |
| `pronunciation` | Discriminating or practising a sound, stress pattern, or spoken form | `phoneme-match`, `sound-choice`, `word-stress`, `listen-and-identify`, `ipa-match`, `repeat` | Speech playback, audio, IPA, and choice options; can precede dictation | Choice-like modes assess perception. `repeat` provides practice but does not by itself perform semantic or pronunciation-quality judging. |
| `dictation` | Converting heard language into written form | `word`, `phrase`, `sentence` | Exactly one playback source: audio or speech; useful after pronunciation work | Configure replay count, accepted answers, case, and punctuation according to the objective. This is sound-to-form production, not general listening comprehension. |
| `speaking-response` | Capturing planned or spontaneous oral production | `part1`, `cue-card`, `part3`, `vocabulary-production` | Prompt bullets, preparation time, response time, target vocabulary, and optional notes | The component captures a local recording and submission state. Mastery claims require a separate evaluation policy or human/automated judge. |
| `writing-response` | Capturing extended written production | `sentence`, `paragraph`, `task1-chart`, `task1-process`, `task2-essay`, `general-letter` | Text, image, chart, or diagram prompt; timer, minimum-word recommendation, planning notes, target vocabulary, model answer, and register | The component records a response and submission state. Word count and target reminders are not semantic scoring; mastery requires downstream evaluation. |

# Selection Rules

* Start with the learner action: present, recognize, discriminate, map, group,
  order, recall, correct, transform, transcribe, speak, or write.
* Use `teaching-card` for presentation; use a scored or submitted interaction to
  collect learning evidence.
* Use `selection` for an unscored learner decision and `choice` for a scored
  answer. Never invent an answer key for a preference or configuration choice.
* Use `number-input` only for an unscored bounded setup value. Use an actual
  scored answer contract when the number itself is the learner's answer.
* Choose between `choice` and `short-answer` based on whether options are part of
  the intended support. Choose between `matching` and `word-formation` based on
  whether the learner maps an existing form or must produce it.
* Use `pronunciation` for sound discrimination or rehearsal and `dictation` for
  sound-to-written-form retrieval. Neither is a substitute for a broader
  listening-comprehension task.
* Use `labeling` only when the learner must preserve the relationship between a
  shared map, plan, or diagram and its marked locations. Forms and tables remain
  `structured-completion`.
* Use a `slides.sequence` exercise to combine interaction families when one
  objective needs staged evidence. Do not create a new exercise component merely
  because the content is called collocation, spelling, or word family.
* Recognition, cued recall, and production can form a useful progression, but do
  not impose that order when the source, prerequisite relationship, or exercise
  objective calls for a different sequence.
* Every sequence needs unique slide IDs and exactly one terminal slide, and that
  terminal slide must be last.

# Dynamic Selection Expansion

A `selection` can choose a path whose complete slide count is known only at
runtime. Its JSON data declares a stable `expansionId`, while the owning parent
provides a runtime-only `selectionExpansion` handler through `ExerciseContext`.
The selection passes the expansion ID, its own slide ID, and the selected option
IDs to the handler. The handler queries the authoritative application source,
returns registered non-terminal slide objects, and the selection inserts them
through the parent deck controller before advancing. The terminal summary stays
last.

This boundary keeps exercise objects serializable and keeps feature queries and
domain mapping out of the reusable selection component. The component owns
selection state, loading/error feedback, and delivery to the deck. The
application handler owns interpreting option IDs, retrieving the complete source
set, and mapping every source item to an existing slide contract. Missing
handlers, empty results, incomplete source coverage, duplicate IDs, terminal
generated slides, or invented answer-bearing content fail closed.

Dynamic rendering and completion verification are separate contracts. A
standalone surface may own completion locally. A persisted Learning Path
exercise must additionally have a backend completion owner that can reconstruct
and verify the generated set; the generic backend verifier cannot infer
arbitrary slides from a frontend handler.

A standalone parent that owns session persistence can provide the runtime-only
`sequenceCompletion` handler through `ExerciseContext`. The sequence awaits it
with the recorded slide results before emitting completion, so persistence
failures leave Finish retryable. Like `selectionExpansion`, this handler is an
application boundary and never belongs in serialized exercise JSON.

Practice Words is the reference implementation: its parent maps the three mode
IDs to a House 1 slide builder. The builder produces one `dictation` slide per
word for vocabulary dictation, or requires sentence-practice coverage for every
House 1 word before producing `cloze` sentence completion or `pronunciation`
repeat slides. Both sentence modes reuse the generic `dialogue` TTS stimulus,
which accepts one or more spoken turns. The Practice Words application session
service records scored attempts and completes or abandons the session; no
practice-specific slide component or serialized service reference is needed.

# Shared Stimuli and Answer Contracts

Reusable slides may use `text`, `audio`, `dialogue`, `image`, `chart`, or `diagram` stimuli.
Text can contain addressable sections; audio can expose a transcript and replay
limit; image and diagram stimuli require accessible alternative text. Chart
stimuli currently permit optional alternative text, but image-backed charts
should provide it. Prefer the stimulus that preserves the evidence source
instead of copying its information into the question.

Constructed-answer families share answer contracts for accepted forms, word
limits, case sensitivity, punctuation sensitivity, and exact spelling. Defaults
should not silently turn a meaning-focused task into a spelling test. Data
configurations are validated fail-closed, so incomplete or contradictory slide
data must be corrected at the source rather than tolerated by the component.

The registry also exposes `message` and `summary` shell content. They support
exercise flow but are not members of the 19 reusable interaction families.

# Composition Examples

* Vocabulary introduction: `teaching-card` -> `matching` (meaning or
  collocation) -> `cloze` -> `speaking-response` or `writing-response` when
  independent production is an explicit objective.
* Spelling and spoken-form practice: `pronunciation` -> `choice` with speech
  playback -> `dictation`. Keep the final dictation constraints aligned with
  whether spelling, case, or punctuation is being assessed.
* Grammar or usage repair: `teaching-card` with contrast/correction Markdown ->
  `error-correction` -> constrained `rewrite`.
* Source-based IELTS completion: one source stimulus ->
  `structured-completion`; preserve the form, table, notes, flowchart, or
  timeline structure instead of converting every field to an isolated item.
* Spatial source task: one image or diagram stimulus -> `labeling`; keep the
  positioned markers and accessible answer list in the same interaction.

# Citations

[1] [Reusable slide data contracts](../../ui/src/app/shared/slide-exercise/library/slide-library.models.ts)
[2] [Default slide registry and scored/submitted chrome](../../ui/src/app/shared/slide-exercise/slide-content-registry.ts)
[3] [Shared slide component behavior](../../ui/src/app/shared/slide-exercise/library/slide-library.component-support.ts)
[4] [Slide sequence exercise contract](../../ui/src/app/domain/collection-learning-path/slide-sequence-exercise.ts)
[5] [Vocabulary-Led Lesson Design](/rules/vocabulary-led-lesson-design.md)
[6] [Selection expansion runtime contract](../../ui/src/app/shared/slide-exercise/slide-content-contracts.ts)
[7] [Generic selection expansion behavior](../../ui/src/app/shared/slide-exercise/library/components/selection/selection-slide.component.ts)
[8] [Practice Words runtime handler](../../ui/src/app/features/practice-words/practice-words-page.component.ts)
[9] [House 1 practice slide builder](../../ui/src/app/application/practice-words/practice-words-slide-builder.service.ts)
[10] [Practice Words session persistence](../../ui/src/app/application/practice-words/practice-words-session.service.ts)
[11] [Sequence completion boundary](../../ui/src/app/features/collection-learning-path/exercises/slides-sequence/slides-sequence-exercise.component.ts)
[12] [Teaching-card Markdown parser](../../ui/src/app/shared/slide-exercise/library/components/teaching-card/teaching-card-markdown.ts)
[13] [Spatial labeling component](../../ui/src/app/shared/slide-exercise/library/components/labeling/labeling-slide.component.ts)
[14] [Server-owned slide completion verifier](../../back/src/domain/collection-learning-path/SlideSequenceExercise.js)
