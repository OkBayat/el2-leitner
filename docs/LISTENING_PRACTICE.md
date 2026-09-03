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

The JSON aggregate contains:

- ordered question groups and their IELTS instructions
- text-completion prompts
- multiple-choice options
- private accepted answers and correct option IDs
- an explicit `schemaVersion`

Relational columns remain only for metadata that the catalog filters or sorts by, such as provider, slug, episode date, status and question count. If future analytics need per-question SQL reporting, a derived read model can be introduced without changing the lesson source of truth.

## CQRS application layer

Queries and commands are separate application use cases:

- `ListListeningLessons` — catalog query
- `StartListeningAttempt` — starts a server-owned attempt and returns a public lesson projection
- `SubmitListeningAttempt` — grades through the Domain layer and completes the attempt atomically
- `ListeningMistakePracticeService` — explicit UI application service that hands a validated missed answer to the existing learning-state command path

The Listening Domain contains lesson validation, strict IELTS answer normalization, grading, and the rule that only an incorrect non-numeric textual answer can become a vocabulary-capture candidate. It has no Express or MySQL dependency. MySQL access for listening attempts remains behind `MySqlListeningPracticeRepository`; vocabulary capture uses the existing Learning persistence boundary.

## Answer-key security

Private answer keys live inside `listening_lessons.content_json`, but the repository and application projection remove them before a lesson is returned to the browser. Public question DTOs contain only prompts and choice options. A learner submits question IDs and values; the server reloads the private aggregate, grades the attempt, stores immutable JSON snapshots, and only then returns feedback.

Text matching normalizes only presentation-equivalent input:

- Unicode NFKC
- leading, trailing and repeated whitespace
- English letter case
- curly apostrophes
- Unicode dash variants

Spelling, singular/plural forms, and different words are not corrected or accepted automatically. Alternative valid spellings must be listed explicitly in the lesson JSON.

The House 1 action is based on answer content rather than question type. Single words such as `inland`, phrases such as `sea levels`, and textual correct options from multiple-choice questions are eligible. For multiple choice, the display label (`A.`, `B.`, or `C.`) is removed before capture. Any answer containing a numeric character is not eligible, including `1C`, `10`, `10 metres`, and Unicode-digit equivalents.

## IELTS content contract

Listening content must preserve genuine IELTS Listening behavior rather than only looking IELTS-like:

- questions are authored in the same chronological order in which their answers appear in the audio
- question `N` must be answerable before question `N+1` unless an official IELTS task type intentionally has different internal behavior, such as matching
- group boundaries, instructions, word/number limits, and response types follow real IELTS Listening conventions
- distractors are plausible and based on the audio context rather than unrelated filler
- spelling and word-form rules remain strict, as in IELTS

## Content format

Built-in lessons are version-controlled JSON files under:

```text
back/data/listening/<provider>/
```

A source lesson contains provider metadata, ordered question groups, public question IDs, prompts, options, and private accepted answers. Text prompts use exactly one `{{blank}}` token. `npm run db:validate:listening` validates the complete content set before tests and deployment.

`db:setup` parses each definition and seeds it transactionally. A SHA-256 source hash makes unchanged seeds true no-ops. A content change increments `content_version` and replaces the single stored JSON aggregate. An already-open attempt is not graded against a different content version.

## Database

Migration `007_listening_practice.sql` creates only two Listening tables:

- `listening_lessons` — searchable lesson metadata plus the complete versioned `content_json` aggregate
- `listening_attempts` — ownership, lifecycle and score columns plus `answers_json` and `result_json` snapshots

The shared lesson row must not contain learner state. Attempts remain separate because they are user-owned, mutable during their lifecycle, and retained as history. Vocabulary captured from a mistake uses the existing vocabulary, collection, and learning-progress tables rather than adding more Listening tables.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/listening/bbc/lessons` | List published BBC lessons |
| `POST` | `/api/listening/bbc/lessons/:lessonSlug/attempts` | Start an attempt and receive questions without keys |
| `POST` | `/api/listening/bbc/attempts/:attemptId/submit` | Grade, persist, and return the result |
| `PUT` | `/api/state` | Existing learning command reused only when the learner explicitly captures a missed answer |

All endpoints require authentication and use `Cache-Control: no-store` through the existing API router policy. Submission is idempotent: retrying a completed attempt returns `result_json` rather than creating duplicate answer records.

## Tests

Coverage includes:

- Domain validation and strict answer normalization
- text and multiple-choice grading
- incomplete submission with unanswered questions graded as incorrect
- single-aggregate JSON seed, true no-op reseeding and content-version changes
- CQRS use-case projections and lesson-version conflicts
- authenticated API behavior, cross-user isolation, and answer-key non-disclosure
- real-database verification of the two-table JSON model
- mistake-candidate rules for single words, multi-word phrases, and multiple-choice answers
- rejection of ASCII and Unicode numeric answers
- creation of a new Listening-mistake answer in House 1 and reset of existing/mastered vocabulary without erasing historical counters
- canonical vocabulary reload after full-state persistence
- Angular domain, application-service, and page-state unit tests
- Angular architecture contract for separate HTML/SCSS/TS files, OnPush, Material controls, typed reactive forms, and the explicit House 1 action
- production Playwright coverage proving submit itself leaves learning state untouched, a multiple-choice mistake offers capture, `sea levels` can be added to House 1, and `1C` cannot
