# Sentence Practice

Sentence Practice is a free-practice mode. It reuses the learner's active Leitner words, but it does **not** perform a Leitner review and the sentence catalog is deliberately independent from vocabulary storage.

## Core model

`sentences` is the only sentence source of truth:

```text
sentences
- id
- language_code
- sentence_text
- optional source/provenance metadata
- status
```

There is intentionally **no** `vocabulary_entry_id`, `word_id`, `answer_text`, foreign key, join table or persisted word-to-sentence relation.

A sentence can be added independently:

```sql
INSERT INTO sentences (language_code, sentence_text, status)
VALUES ('en', 'Her name is Sara.', 'active');
```

No second write is required. The next Sentence Practice session can discover that row for `name` by searching the sentence text.

## Runtime lookup

At session start the backend performs three bounded reads (an empty house stops after the first):

1. active words and accepted spellings for the requested Leitner house;
2. word definitions from `collection_entry_definitions`, scoped to that house and the learner's accessible, active collection subscriptions;
3. active English sentences from the independent catalog.

The Domain layer compiles accepted spellings into Unicode-aware regular expressions and finds complete terms only. For `name`:

```text
Her name is Sara.       -> match
My name is Mohammad.    -> match
Her surname is Sara.    -> no match
```

For a matching sentence the regex result itself determines the cloze boundaries:

```text
Her [name] is Sara.

before = "Her "
after  = " is Sara."
```

No start/end positions are stored in the database.

Accepted aliases also participate in search. If the learner's word is `colour / color`, a sentence containing either spelling is valid. Capitalized proper terms such as `May` are matched case-sensitively so the month is not confused with modal `may`.

A sentence containing the target more than once is rejected because leaving a second visible occurrence would reveal the answer.

## Answer field and word meaning

`SentenceAnswerComponent` owns the inline textarea, glyph-based sizing, and non-modal definition popover. The page continues to own the existing answer control, submission, feedback, and focus lifecycle. No dependencies or database migrations are added.

The textarea has one logical answer line, a dashed underline, and no character-count minimum or horizontal padding. Hidden, accessibility-excluded mirrors use the same typography as the answer: the exact substring omitted from the current sentence establishes its initial width, not the longest accepted alias. A longer typed answer expands the field without clipping; long phrases wrap within the available width. Pasted line breaks become spaces and IME composition never submits an answer prematurely. Submitted answers remain visible and read-only.

Click or tap the gap, or press `Alt+ArrowDown`, to open word meaning. Opening never moves focus or adds a blocking backdrop, so the mobile keyboard can keep editing. Escape, the close button, outside click, a new prompt, and navigation dismiss the popover. The close button and Escape return focus to the textarea.

Each additive card `definitions` item contains a public definition `id`, `text`, `languageCode`, and `collectionTitle`. Definitions are ordered by collection and definition position, deduplicated by identity, and rendered as text, not HTML. Removed entries, inactive subscriptions, archived collections, and other users' private collections are excluded. Older decks and words without definitions show an explicit empty state and remain playable.

These are source-authored word definitions, not generated translations or grammatical analyses of the sentence. The context preview keeps the missing word masked until feedback is available. Loading help does not make per-card HTTP requests or change sentence matching, grading, daily practice accounting, or Leitner scheduling.

## Randomness and future indexing

The active sentence corpus is shuffled for each practice-deck request and up to six matching contexts are selected per word. The UI chooses among those contexts and a failed word returns after three other prompts with a different context when possible.

The current corpus is only a few thousand rows, so scanning it once per session is intentionally simple and avoids N+1 database queries. When sentence volume grows, `MySqlSentencePracticeRepository.findActiveSentences()` is the replacement point for an inverted/full-text/search index. Such an index is derived data only; `sentences` remains the source of truth and can always rebuild the index.

This means adding a new sentence never requires searching all vocabulary and creating link records first.

## Initial corpus and seeding

The checked-in IELTS list remains the generator input:

```text
ui/data/IELTS_Listening_Core_1500.md
```

The seed creates three natural deterministic sentences for each of the 1,500 source items, giving 4,500 initial sentence rows. Source item number, variant number, category and corpus hash are stored only as provenance for idempotent seeding; they are not vocabulary relationships and are nullable for independently added sentences.

Database setup applies `005_sentence_catalog.sql`, seeds the built-in vocabulary collection independently, and seeds the independent sentence catalog:

```bash
cd back
npm run db:setup
```

The migration first removes the temporary `vocabulary_sentences` table if a developer had already run an earlier revision of PR #55. Because the new migration filename is different, the migration runner can apply it without checksum conflicts and then the normal seed rebuilds the independent sentence corpus. Fresh databases simply skip that drop.

Optional commands:

```bash
npm run db:validate:sentences
npm run db:seed:sentences
```

## Review isolation

Sentence Practice never writes the learning/review aggregates. It cannot:

- promote or demote a card;
- alter `due_date`, streaks, attempts or mistakes;
- create a `review_event`;
- put a wrong sentence-practice answer into daily-review remediation.

Only the existing `practice_sessions` aggregate records session-level counts and duration with mode `sentence-house-{n}`.

## Regression coverage

Tests enforce:

- exactly 1,500 source items and 4,500 initial seeded sentences;
- no sentence foreign keys or vocabulary-link columns;
- no `vocabulary_sentences` or `sentence_word_links` table after migration;
- no vocabulary lookup during sentence seeding;
- complete-term regex matching (`name` does not match `surname`);
- phrase/hyphen matching and accepted aliases;
- proper-term case handling (`May` does not match `may`);
- duplicate-target rejection;
- automatic discovery of a newly inserted independent sentence;
- random sentence selection and different-context retries;
- unchanged learning state during browser E2E practice;
- bounded, user-scoped definition reads and backward-compatible card projection;
- textarea editing, composition, feedback, safe definition rendering, and popover dismissal;
- glyph-sized dashed gaps and focus-preserving popovers in desktop and mobile Chromium viewports.
