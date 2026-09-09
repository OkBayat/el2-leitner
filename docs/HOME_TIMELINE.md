# Daily Home timeline

Home (`/dashboard`) is a chronological learning path, not a course-unit list. It starts at the current browser-local day; earlier calendar days remain above and load in seven-day pages. Two future days are shown below. The previous dashboard, including Leitner distribution, charts, exports and new-word controls, is preserved at `/overview` and linked from today's header.

## Meaning of a colored step

Color means **recorded practice**, not perfect accuracy, an opened page, or completion of a fabricated daily quota. The UI never sends a completion command when a path node is clicked.

- Vocabulary review: persisted review events in `review`, `new`, or legacy null mode. Box 1 drills do not color this step.
- Listening: a completed, submitted listening attempt. Merely starting a test is not evidence.
- Shadowing: a server-assessed attempt recorded for a Box 1 shadowing session, including a graded unsuccessful attempt.
- Box 1 wagon: a persisted `box1` review event or a Box 1 sentence-practice attempt.

Practised nodes remain colored in history. Unpractised nodes, including today's next available step, retain a gray face. The next available step has a separate outline and START marker. Future nodes and wagons are gray and disabled. Every day has six slots: vocabulary, listening, shadowing, reading, and two blank reserved positions. Reading is explicitly coming soon because there is no reading workflow in the current application; no fictitious destination or completion is created.

The wagon opens a keyboard-accessible anchored dialog with `/review?mode=box1` and `/sentence?house=1`. The dialog closes on Escape, backdrop click or scrolling, and restores focus to the initiating control.

## Read model and persistence

`GET /api/learning/timeline?timeZone=Asia%2FTehran&limit=7&before=2026-09-01` is authenticated, user-scoped and `no-store`. `before` is an exclusive calendar-day cursor, `limit` is bounded to 1–14, and the timezone must be a valid IANA identifier. Dates are validated before repository access.

The response contains `today`, chronological `days`, `nextBefore`, and `limitedHistory`. Each day contains activity IDs and `boxOnePracticed`, never answer snapshots, word lists, email or another learner's data. History is read from the database rather than the potentially truncated bootstrap history.

Migration `016_practice_session_days.sql` adds a small `(practice_session_id, local_day)` evidence table. Evidence is inserted in the existing attempt transaction; duplicate attempts on the same day do not duplicate a day. No review revision, Leitner progress rule or session-score contract changes. Normal database setup applies the migration; no manual data deletion or progress reset is required.

Existing review and listening history is directly readable. Older sentence/shadowing sessions have session totals but no per-answer dates. Reliable single-day legacy sessions are shown; ambiguous multi-day totals are not assigned to guessed days and produce a limited-history notice. No destructive backfill is performed.

## Loading and verification

Prepending history preserves the existing day's viewport position. A failed request preserves loaded evidence and exposes a retry instead of replacing real progress with gray placeholders. Focus/online/visibility returns refresh the latest page, and a midnight timer requests the next calendar day. Colors are deterministic per calendar date, so prepending history does not recolor previously rendered days.

`Home timeline integration` runs the focused domain/repository tests, rollback coverage, and authenticated HTTP/MySQL 8.4 integration. Home timeline service, dashboard behavior, navigation, accessibility, and responsive contracts stay in the fast Angular component and structural regression suites. Browser E2E is disabled repository-wide until a dedicated, isolated test database exists.
