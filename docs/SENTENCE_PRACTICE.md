# Sentence Practice

Sentence Practice is a free-practice mode that reuses the vocabulary already placed in a learner's Leitner houses, but it does **not** perform a Leitner review.

## Learner experience

1. The Home page exposes **Sentence practice: House 1**.
2. `/sentence?house=1` loads every active, non-mastered House 1 word that has sentence coverage.
3. The target word is pronounced automatically and can also be replayed at the normal or slower rate.
4. A sentence is rendered with the target replaced by an inline text input. The input has only a bottom border and receives focus automatically.
5. Enter checks the spelling against every accepted vocabulary form.
6. Correct and incorrect answers remain visible in the same input until Continue/Enter.
7. An incorrect word is inserted after three other prompts and uses a different sentence variant when possible. It keeps returning until answered correctly.

The endpoint accepts houses 1–5 so additional Home actions can be added without changing the domain or persistence contract.

## Isolation from scheduled review

Sentence Practice intentionally does not call the review command endpoint and never writes `review_events` or `user_vocabulary_progress`. It therefore cannot:

- promote or demote a word;
- alter `due_date`, streaks, attempts or mistake counts;
- add a daily-review answer;
- send a wrong card into the main daily-review remediation queue.

Only the existing `practice_sessions` aggregate is used to record session-level counts and duration. The session mode is `sentence-house-{n}`.

## Data model

Migration `005_sentence_practice.sql` creates `vocabulary_sentences`.

Each row:

- references the canonical `vocabulary_entries.id`;
- preserves the original 1–1500 source item number;
- stores one of three variants;
- stores the source category, complete sentence and audible primary answer;
- is versioned with a deterministic source hash;
- is unique by `(source_key, source_item_number, variant_number)`.

A source item that is an accepted alias of another item still retains its own three sentences while linking to the same canonical vocabulary entry. This means the 1,500 source rows produce exactly 4,500 sentence rows even though the core collection normalizes equivalent vocabulary aliases.

## Corpus generation and seeding

The checked-in IELTS list remains the source of truth:

```text
ui/data/IELTS_Listening_Core_1500.md
```

`SentenceCorpus.js` parses that file and creates three deterministic sentences for every numbered source item. It uses curated examples for high-risk grammar and common form-completion vocabulary, plus category-, part-of-speech- and source-range-aware contexts for the rest. Generated prompts use each answer as a complete term in a natural sentence; they never fall back to answer instructions such as “type this word” or quote the target as a vocabulary label.

Generation fails when any invariant is violated, including duplicate or non-continuous source numbers, missing targets, a target embedded only inside another word, repeated complete targets inside one sentence, duplicate variants, answer-instruction fallback text or excessive length.

Database setup applies the migration, seeds the built-in vocabulary collection and then seeds the sentence corpus. Manual commands are also available:

```bash
cd back
npm run db:validate:sentences   # generate and validate without a database write
npm run db:seed:sentences       # idempotent database seed
```

The seed:

1. hashes the generator version and source file;
2. resolves every source form through `vocabulary_forms` in the built-in collection;
3. fails before writing if any item cannot be linked;
4. upserts in batches inside one transaction;
5. removes rows from older generator versions;
6. verifies 1,500 covered source items and 4,500 active sentences;
7. skips the write transaction entirely when an identical corpus is already present.

## API

```http
GET /api/learning/sentence-practice?house=1
```

The authenticated query returns cards grouped by canonical vocabulary ID, all accepted spellings and sentence segments (`before` and `after`) so the UI never performs unsafe string replacement.

## Test coverage

- Full 1,500-item / 4,500-sentence corpus coverage and uniqueness.
- Natural-context safeguards across nouns, verbs, directions, form fields and spelling traps.
- Complete-term boundary detection, including targets whose letters also occur inside another word.
- Accepted spelling aliases.
- Curated sentence examples and exact target splitting.
- Transactional, batched and idempotent database seeding.
- Backend card grouping and invalid-house validation.
- Authentication and HTTP response contract.
- Answer normalization.
- Three-card retry spacing, finite-deck flushing and different-sentence retries.
- Existing backend, Angular, production build, PWA, Docker smoke and browser suites run in CI.
