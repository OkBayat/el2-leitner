# Sentence Practice

Sentence Practice is a free-practice mode. It reuses the learner's active Leitner words, but it does **not** perform a Leitner review. The sentence catalog remains independent from vocabulary storage.

## Source of truth

`sentences` is the only sentence source of truth:

```text
sentences
- id
- language_code
- sentence_text
- source_key / source_item_number
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

A sentence can have multiple recordings. Vocora stores exactly one row per unique English sentence with audio and chooses the recording deterministically:

1. prefer a recording with an explicit reusable license;
2. if equivalent recordings remain, choose the lowest audio id.

The stored audio URL follows Tatoeba's documented per-recording endpoint:

```text
https://tatoeba.org/audio/download/{audioId}
```

Run migrations/setup first, then run the explicit network-backed import:

```bash
cd back
npm run db:setup
npm run db:import:tatoeba-sentences
npm run db:verify
```

The importer requires `bzip2` or `bunzip2`. The backend Alpine container provides the expected environment for the command.

The default safety floor is **849,774 unique English sentences with audio**, matching the corpus size requested when this importer was introduced. Tatoeba changes continuously, so importing a newer weekly export may produce a larger count. To pin a specific snapshot during an operational run, use:

```bash
npm run db:import:tatoeba-sentences -- --expected-count=<exact-count>
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
2. stages all audio metadata;
3. builds a new `sentences_tatoeba_import` table in batches;
4. validates unique sentence count, text and audio metadata;
5. atomically renames the new table into place;
6. drops the previous audio-less table only after the successful swap.

A failed download, parse, count check or insert leaves the current `sentences` table untouched. A MySQL named lock also prevents two imports from running concurrently.

### Audio licensing

Tatoeba states that when the audio export's license field is empty, that recording may not be reused outside Tatoeba. Vocora still imports the sentence and its audio metadata so the requested corpus is complete, but marks a row `restricted` if the selected recording has no reusable license. Runtime Sentence Practice only queries `active` rows, so restricted audio is never played by the application.

The contributor, license and attribution URL are retained in the database so a later local-audio download can preserve attribution requirements.

## Runtime lookup at 800k+ rows

The old 4,500-row implementation loaded and shuffled the entire active sentence table at session start. That is not acceptable for the Tatoeba corpus.

For each Leitner word, `MySqlSentencePracticeRepository.findCandidateSentences()` now performs a bounded indexed lookup:

- MySQL FULLTEXT lookup for normal words/phrases;
- a small bounded `LIKE` fallback for short tokens/stop words such as `is`, `at` and case-sensitive proper terms such as `May`;
- the existing Unicode-aware domain matcher then verifies complete-term boundaries and rejects false positives such as `name` inside `surname`.

At most 48 database candidates are considered per vocabulary card and at most six verified contexts are returned to the UI. `sentences` remains the source of truth; no vocabulary links are materialized.

## Whole-sentence audio

Every returned practice sentence contains its Tatoeba `audioUrl`. Sentence Practice no longer calls `SpeechSynthesis` for the target word.

When a prompt opens:

1. the full natural human recording is played automatically;
2. **Play sentence** replays the recording;
3. **Slower** replays the same recording at 0.75x;
4. moving to the next prompt, finishing or abandoning stops the current audio.

The production Content Security Policy allows media from `https://tatoeba.org` only in addition to same-origin media.

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
- deterministic preference for licensed audio;
- audio download URL generation;
- bounded candidate lookup instead of loading the complete corpus;
- complete-term matching and accepted aliases;
- whole-sentence audio playback and slower playback;
- different-context retries;
- unchanged Leitner state during browser E2E practice;
- schema/audio invariants and removal of generated IELTS sentence rows after import.

CI intentionally does not download the 800k+ Tatoeba corpus. A fresh database is valid with an empty `sentences` table until the explicit import command is run; browser E2E uses a small Tatoeba-shaped fixture while backend/domain tests exercise the import and lookup contracts.
