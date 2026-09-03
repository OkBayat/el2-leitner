# Listening Practice

Listening Practice is an independent Vocora bounded context for lesson-based, server-graded listening exercises. The first provider is **BBC 6 Minute English**. It is deliberately separate from Vocabulary, Leitner review, and Sentence Practice.

## User flow

1. Open **BBC 6 Minute English** from Home or the application menu.
2. Choose a published lesson.
3. Open the original BBC episode in a separate tab and listen without reading its transcript.
4. Complete every text-completion and single-choice question.
5. Submit the whole exercise once.
6. Review the server-calculated score and the correct/incorrect result for every question.

The first built-in lesson is episode `260903`, **How is climate change affecting extreme weather?**, with 13 IELTS-style questions in four groups.

## Boundaries

```text
Listening Practice
├── lesson catalog
├── IELTS question groups
├── questions, options and private answer keys
└── learner attempts and answer snapshots
```

Listening Practice does not read or write:

- `user_vocabulary_progress`
- `review_events`
- Leitner houses, due dates, streaks or mistake counters
- Sentence Practice data

This keeps the feature isolated and prevents a listening score from affecting vocabulary scheduling.

## CQRS application layer

Queries and commands are separate application use cases:

- `ListListeningLessons` — catalog query
- `StartListeningAttempt` — starts a server-owned attempt and returns a public lesson projection
- `SubmitListeningAttempt` — grades through the Domain layer and completes the attempt atomically

The Domain layer contains lesson validation, strict IELTS answer normalization, and grading. It has no Express or MySQL dependency. MySQL access is behind `MySqlListeningPracticeRepository` and is injected by the composition root.

## Answer-key security

Answer keys are stored in `listening_question_answers` and never returned when a lesson starts. Public question DTOs contain only prompts and choice options. A learner submits question IDs and values; the server reloads the private answer key, grades the attempt, stores answer snapshots, and then returns feedback.

Text matching normalizes only presentation-equivalent input:

- Unicode NFKC
- leading, trailing and repeated whitespace
- English letter case
- curly apostrophes
- Unicode dash variants

Spelling, singular/plural forms, and different words are not corrected or accepted automatically. Alternative valid spellings must be listed explicitly in the lesson JSON.

## Content format

Built-in lessons are version-controlled JSON files under:

```text
back/data/listening/<provider>/
```

A lesson contains provider metadata, ordered question groups, public question IDs, prompts, options, and private accepted answers. Text prompts use exactly one `{{blank}}` token. `npm run db:validate:listening` validates the complete content set before tests and deployment.

`db:setup` parses each definition and seeds it transactionally. A SHA-256 source hash makes unchanged seeds no-ops. A content change increments `content_version`, replaces the lesson question tree, and forces already-open attempts to restart instead of grading against a different answer key.

## Database

Migration `007_listening_practice.sql` creates:

- `listening_lessons`
- `listening_question_groups`
- `listening_questions`
- `listening_question_options`
- `listening_question_answers`
- `listening_attempts`
- `listening_attempt_answers`

Attempt-answer rows store submitted and correct answer snapshots so completed results remain stable if lesson content changes later.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/listening/bbc/lessons` | List published BBC lessons |
| `POST` | `/api/listening/bbc/lessons/:lessonSlug/attempts` | Start an attempt and receive questions without keys |
| `POST` | `/api/listening/bbc/attempts/:attemptId/submit` | Grade, persist, and return the result |

All endpoints require authentication and use `Cache-Control: no-store` through the existing API router policy. Submission is idempotent: retrying a completed attempt returns the stored result rather than inserting duplicate answers.

## Tests

Coverage includes:

- Domain validation and strict answer normalization
- Text and multiple-choice grading
- 10/13 score calculation for the built-in lesson
- JSON seed idempotency and content-version changes
- CQRS use-case projections and lesson-version conflicts
- Authenticated API behavior, cross-user isolation, and answer-key non-disclosure
- Angular domain, API-adapter, application-service, and page-state unit tests
- Angular architecture contract for separate HTML/SCSS/TS files, OnPush, Material controls, and typed reactive forms
- Production Playwright flow from Home to lesson selection, completion, submit, score, feedback, locked fields, and proof that the complete learning state is unchanged
