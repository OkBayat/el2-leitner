# Listening Practice

Listening Practice is an independent Vocora bounded context for lesson-based, server-graded listening exercises. The first provider is **BBC 6 Minute English**. It remains separate from Vocabulary, Leitner review, and Sentence Practice unless the learner explicitly chooses to capture a missed answer for later practice.

## User flow

1. Open **BBC 6 Minute English** from Home or the application menu.
2. Choose a published lesson.
3. Choose one of that lesson's IELTS-style tests.
4. Use the in-app episode player when ready; audio never starts automatically.
5. Answer as many questions as possible and submit when ready; unanswered questions are graded as incorrect.
6. Review the server-calculated score and per-question feedback.
7. Return to the lesson catalog. The completed test is marked **✓ Completed** while unfinished tests remain available.
8. For an incorrect answer whose correct solution contains text but no numeric characters, optionally choose **Add to House 1**.

## Built-in BBC lessons

Each built-in episode currently contains **3 independent IELTS-style tests of 13 questions each**.

| Episode | Lesson | Audio filename |
|---|---|---|
| `260903` | How is climate change affecting extreme weather? | `bbc-6-minute-english-260903.mp3` |
| `260618` | Limiting screen time for children | `bbc-6-minute-english-260618.mp3` |

The `260618` lesson is authored from the BBC transcript **Limiting screen time for children**. Across all three tests, question order follows the episode chronology: screen-time context and regulation → Emily Goodacre on intentional use and higher expectations → enabling child development → Becky Kennedy on eager parents and small shifts → moving devices out of view / setting children up for success → the final smartphone-ownership answer.

## Lesson and test aggregate

A BBC episode is one Listening lesson aggregate. A lesson contains one or more independently selectable tests:

```text
Listening lesson
├── catalog metadata
├── local audio filename
├── Test 1
│   ├── question groups
│   ├── questions/options
│   └── private answer keys
├── Test 2
└── Test N
```

The number of tests is data-driven; the UI does not assume exactly three. New tests can be added to a lesson JSON without introducing new question tables or new Angular pages.

Each test has a stable `id`, display `title`, sequential `position`, ordered IELTS question groups, and its own `questionCount`. Question numbers restart from 1 inside every test. Question, group, option, and test IDs remain unique inside the lesson aggregate.

## Episode audio

MP3 binaries are deployment/local data, not source code. `*.mp3` is ignored by Git and by Docker build context. The repository tracks only the directory documentation; local files live under:

```text
back/data/listening/audio/
```

Docker Compose bind-mounts that directory read-only into the app container. A deployment may alternatively override the directory with `LISTENING_AUDIO_DIRECTORY`.

The database stores only the filename in `listening_lessons.audio_file`. The seed derives it deterministically from the lesson public id, for example:

```text
bbc-6-minute-english-260903.mp3
bbc-6-minute-english-260618.mp3
```

The browser never receives a filesystem path. The selected-test response exposes an authenticated application URL:

```text
/api/listening/bbc/lessons/:lessonSlug/audio
```

The backend resolves the filename from the published lesson, validates it as a safe `.mp3` basename, confines resolution to the configured audio directory, and serves it with byte-range support for seeking.

The Angular audio player is a standalone `OnPush` component with separate `.ts`, `.html`, and `.scss` files. It deliberately has no `autoplay`; `preload="metadata"` is used only to obtain duration metadata. Controls are **Play**, **Stop**, **−5 sec**, and **+5 sec**. Stop pauses and resets playback to the beginning.

## Completion tracking

Completion belongs to a **user + lesson + test**, not to the lesson as a whole.

`listening_attempts.test_id` records which test an attempt belongs to. A test becomes completed after at least one successful submission. Retaking a completed test is still allowed and does not make the other tests completed.

The lesson catalog query returns each test with:

```text
completed: boolean
completedAt: ISO date-time | null
```

This keeps the card lightweight while making completion state persistent across devices and sessions.

## Boundaries

```text
Listening Practice
├── shared lesson aggregate
│   └── tests, groups, questions, options and private answer keys in versioned JSON
└── learner attempts
    ├── selected test id
    └── submitted-answer and result snapshots in JSON

Explicit learner action only
└── missed non-numeric answer
    └── Vocabulary / Leitner House 1
```

Submitting or grading a listening attempt does not write `user_vocabulary_progress`, `review_events`, Leitner houses, due dates, streaks, or mistake counters. The only cross-context write is an explicit **Add to House 1** action after feedback is visible.

That action reuses Vocora's existing learning-state persistence instead of giving Listening Practice its own vocabulary storage. Existing vocabulary is moved back to House 1 for relearning. If the answer is not already visible to the learner, normal vocabulary resolution either reuses an existing shared entry or creates a private vocabulary entry and membership in the learner's existing personal collection. Newly captured answers use the personal section/category **Listening mistakes** rather than creating a new global catch-all collection.

## Why lesson content is JSON

A lesson and all of its tests are authored, validated, loaded, and versioned as one aggregate. Vocora does not currently query or edit individual listening questions through SQL. Keeping the exercise tree in one versioned JSON document follows KISS/YAGNI and makes new IELTS task types and additional tests easy to add.

`listening_lessons.content_json` contains:

- `schemaVersion`
- ordered tests
- ordered question groups and IELTS instructions
- prompts
- multiple-choice options
- private accepted answers and correct option IDs

Relational columns remain only for metadata used to identify, filter, sort, version, or summarize lessons.

## CQRS application layer

Queries and commands are separate application use cases:

- `ListListeningLessons` — catalog query including per-test completion for the authenticated learner
- `GetListeningEpisodeAudio` — resolves safe published audio metadata
- `StartListeningAttempt` — starts the specifically selected test and returns only its public projection
- `SubmitListeningAttempt` — reloads the attempt's private test, grades it through the Domain layer, and completes the attempt atomically
- `ListeningMistakePracticeService` — explicit UI application service that hands a validated missed answer to the existing learning-state command path

The Listening Domain contains lesson/test validation, strict IELTS answer normalization, and grading. It has no Express, Angular, or MySQL dependency. MySQL access for listening attempts remains behind `MySqlListeningPracticeRepository`; vocabulary capture uses the existing Learning persistence boundary.

## Answer-key security

Private answer keys live inside `listening_lessons.content_json`, but the repository/application projection removes them before a selected test is returned to the browser. The browser receives only prompts and visible options. The server reloads the private test on submit, grades it, stores immutable snapshots, and only then returns feedback.

Text matching normalizes only presentation-equivalent input: Unicode NFKC, surrounding/repeated whitespace, English letter case, curly apostrophes, and Unicode dash variants. Spelling, singular/plural forms, and different words are not corrected or accepted automatically unless explicitly authored as alternatives.

## IELTS content contract

Every test must behave like IELTS Listening rather than merely look similar:

- questions follow the chronological order in which their answers occur in the audio
- question `N` is answerable before `N+1` unless the official IELTS task type intentionally behaves differently
- instructions, group boundaries, word/number limits, response types, and distractors follow IELTS conventions
- distractors are plausible and grounded in the episode
- spelling and word-form grading stays strict

## House 1 capture policy

The House 1 action is based on answer content rather than question type. Any incorrect correct-answer text containing letters and **no numeric character** is eligible, including multi-word answers and textual Multiple Choice options. For Multiple Choice, the display label (`A.`, `B.`, `C.`) is removed before capture.

Eligible examples include `inland`, `sea levels`, `the Arctic`, and textual Multiple Choice answers. Ineligible examples include `1C`, `10`, `10 metres`, and Unicode-digit equivalents.

## Content lifecycle

Built-in lessons are version-controlled JSON under `back/data/listening/<provider>/`. The current aggregate schema is `schemaVersion: 2`, where a lesson owns a `tests` array.

`npm run db:validate:listening` validates every JSON lesson before tests and deployment. `db:setup` seeds all definitions transactionally. SHA-256 makes unchanged seeds true no-ops; content changes increment `content_version`; open attempts cannot be graded against a newer lesson version.

## Database

Migration `007_listening_practice.sql` creates the two core Listening tables:

- `listening_lessons` — searchable lesson metadata plus complete versioned `content_json`
- `listening_attempts` — ownership, lifecycle, score, `answers_json`, and `result_json`

Migration `008_listening_tests.sql` adds `test_id` to `listening_attempts`, backfills existing attempts to `test-1`, and adds indexes for per-test completion queries.

Migration `009_listening_audio.sql` adds the per-lesson local MP3 filename.

No per-question relational tables are introduced.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/listening/bbc/lessons` | List lessons plus the authenticated learner's per-test completion state |
| `GET` | `/api/listening/bbc/lessons/:lessonSlug/audio` | Stream the authenticated lesson MP3 with byte-range seeking |
| `POST` | `/api/listening/bbc/lessons/:lessonSlug/tests/:testId/attempts` | Start the selected test and receive its questions without answer keys |
| `POST` | `/api/listening/bbc/attempts/:attemptId/submit` | Grade and complete that attempt |
| `PUT` | `/api/state` | Existing Learning command reused only when the learner explicitly captures a missed answer |

All endpoints require authentication and use `Cache-Control: no-store`. Submission remains idempotent.

## Angular

The lesson card renders `lesson.tests` dynamically. Each test button routes to:

```text
/bbc-6-minute-english/:lessonSlug/tests/:testId/practice
```

The practice page remains outside `AppShell`, reads both route parameters, renders only the selected test, and embeds the in-app audio player. Components remain standalone, `OnPush`, Material-based, and use separate `.ts`, `.html`, and `.scss` files with typed reactive forms.

## Tests

Coverage includes:

- schema-v2 Domain validation for multiple ordered tests
- 13 sequential questions per test and IELTS audio-order regression for both built-in episodes
- JSON seed idempotency and deterministic audio filenames
- selected-test CQRS and unknown-test rejection
- per-user/per-test completion query behavior
- authenticated API selection, completion, answer-key non-disclosure, idempotent submission, cross-user isolation, and the new `260618` lesson
- MySQL test-aware persistence and database verification for both built-in lessons
- Angular domain/API/application/page/player/architecture tests
- focused component, application, contract, and persistence tests covering catalog cards, ordered tests, completion tracking, audio controls/no-autoplay, and House 1 mistake capture
