# Sentence Practice

Sentence Practice is a free-practice mode. It reuses the learner's active Leitner words, but it does **not** perform a Leitner review. The sentence catalog remains independent from vocabulary storage.

## Source of truth

`sentences` is the only sentence/audio source of truth:

```text
sentences
- id
- language_code
- sentence_text
- source_key / source_item_number / variant_number
- audio_id / audio_url
- audio_contributor / audio_license / audio_attribution_url
- status
```

There is intentionally no `vocabulary_entry_id`, `word_id`, `answer_text`, foreign key, join table or persisted vocabulary-to-sentence relation.

PR #55 initially generated 4,500 local example sentences without recorded audio. Those rows are no longer seeded. The Tatoeba importer atomically replaces the sentence catalog, so after a successful import the old generated audio-less rows are gone.

## Tatoeba import

Vocora uses Tatoeba's official weekly English exports:

```text
https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2
https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_with_audio.tsv.bz2
```

Tatoeba's documented formats are:

```text
sentences:
Sentence id [tab] Lang [tab] Text

audio:
Sentence id [tab] Audio id [tab] Username [tab] License [tab] Attribution URL
```

The number shown by Tatoeba's English audio index is a **recording count**, not necessarily a unique-sentence count. One sentence can have several human recordings from different contributors.

Vocora therefore imports **every audio export row**. Each database row is one `sentence + audio recording` pair:

- `source_item_number` = Tatoeba sentence id;
- `variant_number` = deterministic recording ordinal for that sentence, ordered by audio id;
- `audio_id` = globally unique Tatoeba recording id;
- `audio_url` = Tatoeba's documented per-recording download endpoint.

The stored audio URL is:

```text
https://tatoeba.org/audio/download/{audioId}
```

The default safety floor is **849,774 English audio recordings**, matching the Tatoeba count requested when this importer was introduced. Tatoeba changes continuously, so a newer weekly export may contain more rows.

Run migrations/setup first, then the explicit network-backed import:

```bash
cd back
npm run db:setup
npm run db:import:tatoeba-sentences
npm run db:verify
```

With Docker Compose, the import can run in the administrative setup container so the required database credentials and `bzip2` binary are available:

```bash
docker compose run --rm db-setup npm run db:import:tatoeba-sentences
```

To pin an exact export count during an operational run:

```bash
npm run db:import:tatoeba-sentences -- --expected-count=<exact-recording-count>
```

For already-downloaded exports:

```bash
npm run db:import:tatoeba-sentences -- \
  --sentences-file=/path/to/eng_sentences.tsv.bz2 \
  --audio-file=/path/to/eng_sentences_with_audio.tsv.bz2
```

### Atomic replacement

The importer never deletes the current catalog first. It:

1. downloads/opens both official exports;
2. stages every audio recording and its metadata;
3. builds a new `sentences_tatoeba_import` table in bounded batches;
4. imports every recording for every referenced English sentence;
5. builds the FULLTEXT index once after the bulk inserts;
6. verifies recording count, distinct `audio_id` count, source-sentence coverage, text and audio metadata;
7. atomically renames the new table into place;
8. drops the previous audio-less table only after the successful swap.

A failed download, parse, count check, insert or index build leaves the current `sentences` table untouched. A MySQL named lock also prevents two imports from running concurrently.

### Audio licensing

Tatoeba states that when the audio export's license field is empty, that recording may not be reused outside Tatoeba. Vocora still stores that recording row and its URL so the imported database mirrors the requested audio export, but marks the row `restricted`. Runtime Sentence Practice only queries `active` rows, so restricted recordings are never played by the application.

The contributor, license and attribution URL are retained in the database so a later local-audio download can preserve attribution requirements.

## Runtime lookup at 800k+ rows

The old 4,500-row implementation loaded and shuffled the entire active sentence table at session start. That is not acceptable for the Tatoeba corpus.

For each Leitner word, `MySqlSentencePracticeRepository.findCandidateSentences()` now performs a bounded lookup:

- MySQL FULLTEXT lookup for normal words/phrases;
- a bounded `LIKE` fallback for short tokens/stop words such as `is`, `at` and case-sensitive proper terms such as `May`;
- up to four times the requested candidate count may be read so multiple recordings of the same source sentence can be collapsed;
- candidates are de-duplicated by Tatoeba source sentence before they reach the practice deck;
- the existing Unicode-aware domain matcher then verifies complete-term boundaries and rejects false positives such as `name` inside `surname`.

At most 48 unique database sentence candidates are considered per vocabulary card and at most six verified contexts are returned to the UI. All recordings remain in the database; duplicate text is hidden only at runtime.

## Whole-sentence audio

Every returned practice sentence contains its Tatoeba `audioUrl`. Sentence Practice does not use `SpeechSynthesis` for the target word or for the sentence.

When a prompt opens:

1. the full natural human recording is played automatically;
2. **Play sentence** replays the recording;
3. **Slower** replays the same recording at 0.75x;
4. moving to the next prompt, finishing or abandoning stops the current audio.

The production Content Security Policy allows media from Tatoeba's documented endpoint and audio delivery host in addition to same-origin media.

## Review isolation

Sentence Practice never writes the learning/review aggregates. It cannot:

- promote or demote a card;
- alter due dates, streaks, attempts or mistakes;
- create a review event;
- put a wrong sentence-practice answer into daily-review remediation.

Only the existing `practice_sessions` aggregate records session-level counts and duration with mode `sentence-house-{n}`.

## Regression coverage

Tests cover:

- Tatoeba sentence/audio export parsing;
- preservation of multiple recordings for one source sentence;
- reusable-vs-restricted audio licensing state;
- audio download URL generation;
- bounded candidate lookup instead of loading the complete corpus;
- runtime de-duplication of multi-speaker source sentences;
- complete-term matching and accepted aliases;
- whole-sentence audio playback and slower playback;
- different-context retries;
- unchanged Leitner state during browser E2E practice;
- schema/audio invariants and removal of generated IELTS sentence rows after import.

CI intentionally does not download the 800k+ Tatoeba corpus. A fresh database is valid with an empty `sentences` table until the explicit import command is run; browser E2E uses a small Tatoeba-shaped fixture while backend/domain tests exercise the import and lookup contracts.
