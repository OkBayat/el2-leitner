# Listening Practice

Listening Practice is an independent Vocora bounded context for lesson-based, server-graded listening exercises. The first provider is **BBC 6 Minute English**. It remains separate from Vocabulary, Leitner review, and Sentence Practice unless the learner explicitly chooses to capture a missed answer for later practice.

## User flow

1. Open **BBC 6 Minute English** from Home or the application menu.
2. Choose a published lesson.
3. Open the official BBC audio page in a separate tab and listen without reading its transcript.
4. Answer as many text-completion and single-choice questions as possible.
5. Submit the whole exercise; unanswered questions are graded as incorrect.
6. Review the server-calculated score and the correct/incorrect result for every question.
7. For an incorrect answer whose correct solution contains text but no numeric characters, optionally choose **Add to House 1**.

The first built-in lesson is episode `260903`, **How is climate change affecting extreme weather?**, with 13 IELTS-style questions in four groups.

## Boundaries

```text
Listening Practice
├── shared lesson aggregates
│   └── groups, questions, options and private answer keys in versioned JSON
└── learner attempts
    └── submitted-answer and result snapshots in JSON

Explicit learner action only
└── missed non-numeric answer
    └── Vocabulary / Leitner House 1
```

Submitting or grading a listening attempt does not write `user_vocabulary_progress`, `review_events`, Leitner houses, due dates, streaks, or mistake counters. The only cross-context write is an explicit **Add to House 1** action after feedback is visible.

That action reuses Vocora's existing learning-state persistence instead of giving Listening Practice its own vocabulary storage. Existing vocabulary is moved back to House 1 for relearning. If the answer is not already visible to the learner, normal vocabulary resolution either reuses an existing shared entry or creates a private vocabulary entry and membership in the learner's existing personal collection. Newly captured answers use the personal section/category **Listening mistakes** rather than creating a new global catch-all collection.

## Why lesson content is JSON

A listening lesson is authored, validated, loaded and displayed as one aggregate. Vocora does not currently query or edit individual questions through SQL. Keeping the exercise in one versioned JSON document therefore follows KISS and YAGNI while making new IELTS task types easier to add.

The JSON aggregate contains ordered question groups, IELTS instructions, prompts, multiple-choice options, private accepted answers, correct option IDs, and an explicit `schemaVersion`. Relational columns remain only for metadata that the catalog filters or sorts by, such as provider, slug, episode date, status and question count.

## CQRS application layer

Queries and commands are separate application use cases:

- `ListListeningLessons` — catalog query
- `StartListeningAttempt` — starts a server-owned attempt and returns a public lesson projection
- `SubmitListeningAttempt` — grades through the Domain layer and completes the attempt atomically
- `ListeningMistakePracticeService` — explicit UI application service that hands a validated missed answer to the existing learning-state command path

The Listening Domain contains lesson validation, strict IELTS answer normalization, grading, and the rule that only an incorrect non-numeric textual answer can become a vocabulary-capture candidate. It has no Express or MySQL dependency. MySQL access for listening attempts remains behind `MySqlListeningPracticeRepository`; vocabulary capture uses the existing Learning persistence boundary.

## Answer-key security

Private answer keys live inside `listening_lessons.content_json`, but the repository and application projection remove them before a lesson is returned to the browser. Public question DTOs contain only prompts and choice options. A learner submits question IDs and values; the server reloads the private aggregate, grades the attempt, stores immutable JSON snapshots, and only then returns feedback.

Text matching normalizes only presentation-equivalent input: Unicode NFKC, surrounding/repeated whitespace, English letter case, curly apostrophes, and Unicode dash variants. Spelling, singular/plural forms, and different words are not corrected or accepted automatically unless explicitly authored as alternatives.

## House 1 capture policy

The House 1 action is based on answer content rather than question type.

Eligible examples:

- `inland`
- `sea levels`
- `the Arctic`
- textual correct options from multiple-choice questions

For multiple choice, the display label (`A.`, `B.`, or `C.`) is removed before capture, so `B. They remain in the same area for longer.` becomes `They remain in the same area for longer.`.

Ineligible examples are any answers containing a numeric character:

- `1C`
- `10`
- `10 metres`
- Unicode-digit equivalents

This rule deliberately allows multi-word phrases and multiple-choice answer text while excluding numeric answers.

## IELTS content contract

Listening content must preserve genuine IELTS Listening behavior rather than only looking IELTS-like:

- questions are authored in the same chronological order in which their answers appear in the audio
- question `N` must be answerable before question `N+1` unless an official IELTS task type intentionally behaves differently, such as matching
- group boundaries, instructions, word/number limits, and response types follow real IELTS Listening conventions
- distractors are plausible and based on the audio context
- spelling and word-form rules remain strict

## Content lifecycle

Built-in lessons are version-controlled JSON under `back/data/listening/<provider>/`. `npm run db:validate:listening` validates content before tests and deployment. `db:setup` seeds definitions transactionally. SHA-256 makes unchanged seeds true no-ops; content changes increment `content_version`; open attempts cannot be graded against a newer version.

## Database

Migration `007_listening_practice.sql` creates only two Listening tables:

- `listening_lessons` — searchable lesson metadata plus the complete versioned `content_json` aggregate
- `listening_attempts` — ownership, lifecycle and score columns plus `answers_json` and `result_json` snapshots

Vocabulary captured from a mistake uses the existing vocabulary, collection, and learning-progress tables rather than adding Listening-specific storage.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/listening/bbc/lessons` | List published BBC lessons |
| `POST` | `/api/listening/bbc/lessons/:lessonSlug/attempts` | Start an attempt and receive questions without keys |
| `POST` | `/api/listening/bbc/attempts/:attemptId/submit` | Grade, persist, and return the result |
| `PUT` | `/api/state` | Existing learning command reused only when the learner explicitly captures a missed answer |

All endpoints require authentication and use `Cache-Control: no-store`. Submission is idempotent.

## Tests

Coverage includes Domain validation/grading, incomplete submissions, JSON seed versioning, CQRS use cases, authenticated API behavior, MySQL JSON persistence, single/multi-word/multiple-choice mistake capture, ASCII and Unicode numeric rejection, existing/mastered vocabulary reset, canonical vocabulary reload, Angular unit/architecture tests, and production Playwright coverage proving that `sea levels` can be added to House 1 while `1C` cannot.
