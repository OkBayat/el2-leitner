# File-managed listening episodes

This directory is the deploy-time source of truth for podcast metadata, IELTS-style tests, and episode vocabulary. It extends [the PR #63 collection contract](../../../../docs/COLLECTION_SOURCES.md), reusing global vocabulary identities, definitions, examples and the existing Leitner activation APIs. The application never serves this directory as a static directory.

## Directory contract

```text
back/data/listening/episodes/
├── README.md
├── 2026-06-18-limiting-screen-time-for-children/
│   ├── episode.json       # Metadata, episode level, source provenance
│   ├── listening.json     # One or more tests, difficulty, private answer keys
│   ├── cover.jpg          # The actual episode cover; jpg/jpeg/png/webp supported
│   ├── audio.mp3          # Local installation only: ALWAYS gitignored
│   ├── transcript.md      # File-only reference; NEVER imported into the database
│   ├── vocabulary.md      # Episode vocabulary, definitions and original examples
│   └── BUNDLE.json        # Optional ZIP checksums; generated, never imported
└── 2026-09-03-climate-change-extreme-weather/
    └── ...
```

Exactly one **flat** `YYYY-MM-DD-lowercase-slug` folder per episode; no year/provider subdirectories. Its date must equal `episodeDate`. Names may contain ASCII lowercase letters, numbers and hyphens, with a maximum of 160 characters. The folder name is an asset location, **not** the database identity. Do not use symbolic links. All six content files must be nonempty; `audio.mp3` is the sole permitted missing file in a Git checkout. Audio is required for a deliverable bundle. Text files are UTF-8 and at most 2 MB; cover files at most 10 MB; MP3 files at most 100 MB. A missing/empty catalog fails deployment instead of silently importing nothing.

The two pre-existing BBC lessons have been migrated without changing public episode IDs, test/question/option IDs, answers, or the three tests per episode. Completed attempts retain their snapshots. They are not deleted and recreated.

## `episode.json` — schema version 1

Use the checked-in screen-time episode as the complete runnable example. Its fields are:

| Field | Contract |
| --- | --- |
| `schemaVersion` | Integer `1`, not the test schema's `2`. |
| `publicId` | Stable 3–64-character lowercase alphanumeric/hyphen identifier, e.g. `bbc-6-minute-english-260618`. Never change to edit a lesson. |
| `provider` | `bbc_6_minute_english` for the existing BBC UI. |
| `slug` | Unique URL slug for this provider, e.g. `limiting-screen-time-for-children`; at most 160 characters. Keep stable to preserve bookmarks. |
| `title` | Episode title, at most 255 characters. |
| `description` | Optional original introduction, at most 4,000 characters; do not paste a copyrighted article. |
| `episodeCode` | BBC code, e.g. `260618`; use the code confirmed by the source page. |
| `episodeDate` | Real ISO date `2026-06-18`, matching the folder prefix. |
| `publishedAt` | ISO date-time or `null`; use an actual source date, not a fabricated release time. |
| `sourceUrl` | HTTPS official episode page. |
| `status` | `draft`, `published`, or `archived`; only `published` is shown. |
| `level` | Required: `elementary`, `intermediate`, or `advanced`. The spelling is **elementary**, not `elementry`. |
| `audioFile` | Exactly `audio.mp3`. |
| `imageFile` | Exactly `cover.jpg`, `cover.jpeg`, `cover.png`, or `cover.webp`, matching actual bytes. |
| `sources` | Optional provenance object with `audioUrl`, `imageUrl`, `transcriptUrl`, `vocabularyUrl`, `attribution`, `retrievedAt`; URL fields must be HTTPS. Strongly recommended for every source episode. |

Unknown top-level metadata fields fail validation. Do not put answers, transcript text, database IDs, absolute file paths or remote playback URLs into metadata. `sources.audioUrl` records the original download source; playback always uses local episode assets (with a legacy local-audio fallback).

### Episode level is not test difficulty

`level` describes the language of the recording. Every test has a separate `difficulty`:

| Value | UI label | Authoring guideline |
| --- | --- | --- |
| `very_easy` | Very easy | Strong cues, familiar information, little paraphrasing. |
| `easy` | Easy | Mainly explicit detail, limited paraphrasing. |
| `medium` | Medium | Mix of detailed listening and moderate paraphrasing. |
| `hard` | Hard | Closely related distractors, less direct wording, denser detail. |
| `very_hard` | Very hard | Subtle distinctions and demanding but unambiguous information selection. |

These are Vocora editorial labels, **not official BBC levels or IELTS band estimates**. An intermediate episode can have both easy and hard tests. Difficulty must come from meaningful task design, not merely changing the badge or adding ambiguous questions. The migrated existing tests retain a medium label; do not advertise them as newly calibrated IELTS examinations.

## `listening.json` — schema version 2

Its only top-level fields are `schemaVersion: 2` and a nonempty `tests` array. Each test requires `id`, `title`, sequential `position` starting at 1, `format: "ielts"`, a valid `difficulty`, and nonempty `groups`. There is no fixed three-test limit: author exactly the count requested by the user. IDs must be unique within the episode for tests, groups, questions and options; use a test prefix in every child ID, e.g. `bbc-260618-t2-question-3`. IDs match `[a-z0-9][a-z0-9-]{2,63}`.

The following is a **synthetic schema illustration**, not a BBC exercise to publish unchanged:

```json
{
  "schemaVersion": 2,
  "tests": [{
    "id": "test-1",
    "title": "Detail practice",
    "position": 1,
    "format": "ielts",
    "difficulty": "easy",
    "groups": [{
      "id": "sample-t1-group-1",
      "position": 1,
      "heading": "Questions 1–2",
      "taskType": "note_completion",
      "instruction": "Complete the notes below.",
      "answerInstruction": "Write ONE WORD for each answer.",
      "maxWords": 1,
      "maxNumbers": 0,
      "questions": [{
        "id": "sample-t1-question-1",
        "number": 1,
        "position": 1,
        "responseType": "text",
        "prompt": "The meeting will take place on {{blank}}.",
        "answers": ["Friday"]
      }, {
        "id": "sample-t1-question-2",
        "number": 2,
        "position": 2,
        "responseType": "text",
        "prompt": "Participants should bring a {{blank}}.",
        "answers": ["notebook"]
      }]
    }]
  }]
}
```

Supported task types are `note_completion`, `sentence_completion`, `short_answer` (all `responseType: "text"`), and `multiple_choice_single` (`responseType: "single_choice"`). Text prompts contain **exactly one** `{{blank}}`; even short-answer prompts include an answer blank. `answers` is a nonempty array of accepted strings; the first is the displayed model answer. Do not duplicate answers that normalize to the same value. Every answer must obey `maxWords` and `maxNumbers` and the written instruction. Word/number limits may be `null` where appropriate.

Multiple-choice prompts contain no blank. Provide 2–6 `options`, each with a unique `id`, unique `label` (normally A/B/C) and `text`; `answer` is the correct **label**, e.g. `"B"`, not the option ID. A choice group uses `maxWords: null` and `maxNumbers: null`. The server maps the label to the option identity. Do not send the answer field to the browser.

Test/group/question positions start at 1 and are contiguous. Question `number` runs consecutively across all groups in a test; question `position` restarts within each group. `questionCount` and `testCount` are computed by the parser, not authored fields.

### IELTS-style content quality

Write original questions grounded in the actual recording and your authorized reference transcript. Keep questions in audio order; make one answer clearly correct; use plausible distractors without requiring outside knowledge; check spelling, accepted variants and answer limits. Do not use True/False/Not Given as an IELTS Listening task. These short episode tests are practice activities, not a full 40-question IELTS paper, official IELTS content, or a calibrated band score. Avoid copying BBC quiz text, worksheets or explanations. Vocabulary definitions and example sentences should also be independently worded.

The validation authority is `back/src/domain/listening-practice/ListeningLessonDefinition.js` plus `loadListeningEpisodeSources.js`, not an imagined API schema. The existing screen-time `listening.json` demonstrates all supported task types.

## `vocabulary.md` — same model as PR #63

```markdown
# Episode title — Vocabulary

## Episode vocabulary

- intentional
  - definition: Done deliberately, with a clear aim.
  - example: Taking a walk after lunch was an intentional choice.

- set someone up for something
  - definition: Give a person the conditions or preparation needed for a later activity.
  - example: Good training can set someone up for something more demanding.
```

List the words/collocations actually introduced in the episode, normally a small set. One `#` title and at least one `##` source section are required. Every top-level bullet is one vocabulary identity. Every episode entry requires **at least one definition AND one natural example**, which is stricter than the generic parser's optional-example rule. An example intended for sentence practice must contain exactly one accepted form. Use simple English and sensible original sentences. Multiple definitions/examples are supported.

Separate accepted spellings/forms with ` / ` on the same top-level line; these must be variants of the same identity, not synonyms. Do not repeat an identity in the file. Global words and sentences are reused, never copied into a new personal word identity. Definitions remain collection-specific. Episode example references use `collection_entry_examples` so another book's example is not accidentally shown on this page; global sentence text is deduplicated. The current PR #63 provenance cleanup retires obsolete links and unreferenced, non-curated sentences while preserving references needed by other collections.

The episode collection public ID equals `episode.publicId`, and its slug is `podcast-<episode.publicId>`. Opening the vocabulary page is read-only. Adding one/all subscribes only when needed, refreshes the canonical state/revision, then invokes the existing individual/batch activation commands in batches of at most 50. Learning, mastered and excluded words are not reset. Only the episode's selected new global vocabulary IDs are activated; definitions/examples and pronunciation are shown on the dedicated episode page.

## Transcript policy

`transcript.md` is required as a file but its text is **never read into the synchronization payload, source hash, database, or public API**. Keep full speaker-labelled text there only when you have permission to use it. No timestamps are required by the current UI. Do not fabricate omitted passages or call a summary a full transcript.

The provided BBC examples contain a clearly marked `TRANSCRIPT_SOURCE_ONLY` reference file with the official transcript link. **They do not include the complete BBC transcript.** The normal packager rejects that marker. `--allow-source-transcript` permits an explicitly incomplete demonstration ZIP whose `BUNDLE.json` says `transcriptStatus: source_reference_only`. Import an authorized local UTF-8 transcript to replace it:

```bash
python3 back/scripts/manage-listening-episode.py import-transcript \
  back/data/listening/episodes/2026-06-18-limiting-screen-time-for-children \
  --from /path/to/your-authorized-full-transcript.md
```

This tool does not claim that arbitrary supplied text is complete or licensed; the author must verify that. Imported files are labelled `provided_unverified` in the bundle manifest. Availability of a BBC audio/image/PDF URL does not grant redistribution rights. Preserve source credits and check your intended use before public or commercial redistribution.

## AI-agent workflow: find one episode, author N tests, return a ZIP

1. Resolve the requested BBC 6 Minute English title/date/code against the **actual official episode page**. The public feed `https://podcasts.files.bbci.co.uk/p02pc9tn.rss` can aid discovery but must not be assumed to contain the entire historical archive. Do not invent a JSON API or infer unverified assets from a date-based filename.
2. Inspect the official page's episode-specific hero/OpenGraph image (not the generic show cover), **Download Audio** link, transcript link and vocabulary section. Record the observed HTTPS URLs in `episode.json.sources`. Prefer the direct lesson audio over podcast-feed editions that may have different timing. Record the source's publication date and preserve provider credits.
3. Create one new date/slug folder. For an existing episode, retain `publicId`, URL slug and existing test IDs; append new uniquely identified tests rather than resetting completion history. Choose the episode language level separately from the difficulty of each test. Do not silently downgrade an existing published lesson to draft.
4. Download the verified media, or accept user-supplied media they are authorized to use. The helper below only fetches the manifest's official BBC image/audio URLs; it validates the host (including redirects), file sizes and media signatures and writes atomically. It does **not** manufacture URLs or fetch a full transcript. BBC availability/network restrictions can still cause download failure; do not replace missing bytes with HTML or a fake MP3.
5. Use your authorized transcript/audio reference to write exactly N original IELTS-style tests, with supported task types and distinct question IDs. Verify every answer against the recording, in order, and run a second content-quality review. Do not merely duplicate a test or relabel its difficulty.
6. Prepare `vocabulary.md` using the actual introduced words/collocations, original simple definitions and one or more meaningful examples per entry. Import your authorized full `transcript.md`, or explicitly disclose a source-reference-only package.
7. Run validation, unit tests and the packager. Inspect ZIP paths, `BUNDLE.json`, test count, transcript status and file hashes before delivery. Include cover, actual MP3 bytes, metadata, tests, vocabulary and transcript/reference file, with no unrelated files. Never commit the MP3, a ZIP containing MP3s, or temporary downloaded pages to Git.

```bash
# Run from the repository root. Requires Python 3 and Node.js; no extra Python packages.
EPISODE=back/data/listening/episodes/2026-06-18-limiting-screen-time-for-children
python3 back/scripts/manage-listening-episode.py fetch-assets "$EPISODE"
# Existing assets are retained unless --overwrite is explicitly supplied.
node back/scripts/validate-listening-lessons.js --require-audio --episode "$EPISODE"
python3 back/scripts/manage-listening-episode.py package "$EPISODE" \
  --output /tmp/bbc-260618.zip
# Only for a disclosed source-reference-only demonstration:
python3 back/scripts/manage-listening-episode.py package "$EPISODE" \
  --allow-source-transcript --output /tmp/bbc-260618-source-reference.zip
```

Suggested agent instruction:

> Follow `back/data/listening/episodes/README.md`. Find the official BBC 6 Minute English episode [title/date/URL], preserve or assign its stable identity, prepare an [episode level] episode with [N] original IELTS-style tests at [requested difficulties], verify every answer, add the introduced vocabulary with original definitions/examples, fetch the verified cover/audio, include my authorized full transcript (otherwise explicitly disclose the source-only limitation), validate, and return one checksummed ZIP. Do not commit audio or overwrite unrelated lessons.

## Deployment and synchronization

Install the bundle **on the actual server**, not only on a workstation. Because MP3s are gitignored, `git pull` and CI-built images cannot carry them. From the repository root:

```bash
# Inspect the ZIP first; use -n to preserve existing edited files.
unzip -l /path/to/bbc-260618-source-reference.zip
unzip -n /path/to/bbc-260618-source-reference.zip -d back/data/listening/episodes
# JSON/Markdown/covers belong in Git; MP3s do not.
git check-ignore back/data/listening/episodes/*/audio.mp3
# Run this for EVERY deployment, including content-only updates:
bash scripts/deploy.sh
```

### Validated bundle installation (recommended)

The preparation helper also verifies and installs bundles. It checks all seven ZIP members, rejects duplicate names, traversal paths, links, oversized files and unexpected content, verifies every SHA-256/byte count and runs the actual Node episode validator before writing anything. Checksums detect corruption; they are **not digital signatures or proof of authorship**. Only install bundles from a trusted author.

```bash
BUNDLE=/path/to/vocora-bbc-260618-source-reference.zip
CATALOG=back/data/listening/episodes
python3 back/scripts/manage-listening-episode.py verify "$BUNDLE"

# The sample episode is already tracked in this PR: install ONLY its missing MP3.
# JSON, cover, vocabulary and any locally supplied full transcript remain untouched.
python3 back/scripts/manage-listening-episode.py install "$BUNDLE" \
  --into "$CATALOG" --audio-only

# For a NEW episode folder, install the complete validated bundle instead.
python3 back/scripts/manage-listening-episode.py install /path/to/new-episode.zip \
  --into "$CATALOG"
# A disclosed source-reference-only bundle additionally requires --allow-source-transcript.

bash scripts/deploy.sh
```

The destination catalog must already exist. Full installation refuses an existing episode directory, stages outside the watched catalog and moves the new directory into place only after validation. `--audio-only` requires the existing episode identity to match; identical audio is a no-op, and a different existing MP3 is never overwritten. To change a recording deliberately, back up the current MP3 and remove it explicitly first. Both modes reject symlinked destination paths. They do not execute SQL, edit Git tracking or deploy the application themselves.

The first sample remains **source-reference-only for the full transcript**, regardless of successful schema/integrity checks. A `provided_unverified` transcript is supplied content, not an automatic assertion of completeness or redistribution permission. The audio-only path preserves a full transcript you have already installed locally.

The deploy script builds the app/setup image, waits for MySQL, runs a **fresh** `db-setup` container, and restarts the app only after setup succeeds. Do not rely on a previously completed one-shot `db-setup` container to rerun when only a bind-mounted JSON file changed. Existing first-time `docker compose up --build` remains supported; `scripts/deploy.sh` is the repeatable update command. This script does not call `git pull`, delete files, or remove database volumes.

Both setup and app mount `./back/data/listening/episodes` read-only at `/app/back/data/listening/episodes`. The Node runtime can instead use `LISTENING_EPISODES_DIRECTORY=/absolute/path/to/episodes`; both the setup command and server must receive the same setting. Do not mount an empty directory over the catalog. The legacy `back/data/listening/audio/<episode-publicId>.mp3` location remains a safe fallback while existing installations move their files. A missing MP3 does not block Git-only CI or database synchronization; playback returns a controlled 404 until a local file is installed. Images must be present.

`npm --prefix back run db:setup` applies migrations, syncs the PR #63 collections, then validates the **entire** episode catalog before any episode DML. It takes a database-scoped advisory lock, and synchronizes episode collections and lessons in one transaction. A failure rolls that episode-catalog transaction back; parallel deployments serialize. Earlier independent database migrations/general collection work are not part of this transaction. The flat `back/data/collections/*.md` importer archives missing flat-file sources only; it does not own the `listening/episodes/...` source namespace. Migration `014_listening_episode_sources.sql` reuses PR #63's `collection_entry_examples` table and adds episode metadata plus example ordering; it does not create a competing example table.

| Source change | Database effect |
| --- | --- |
| New episode identity | Insert linked collection and lesson. |
| Changed metadata or parsed test content | Update the existing lesson and increment its content version. A title/status change also updates the related collection metadata. |
| Changed vocabulary/definitions/examples | Update the same collection and contextual references; preserve global word IDs and learner progress. Listening content version is unchanged for vocabulary-only edits. |
| Unchanged parsed content, JSON key order or harmless whitespace | No INSERT/UPDATE/DELETE for that episode/collection; versions and timestamps stay unchanged. |
| Only cover/audio/transcript file bytes change | No lesson/collection content update; assets are read from disk. Transcript text never enters the hash. |
| Folder renamed but identity retained | Update asset location/provenance, not a duplicate lesson. |
| Folder disappears | Do not delete existing lessons, results, collections or progress. Restore it or explicitly archive it; its missing assets cannot play. |
| `status: "archived"` or `draft` | Hide episode and vocabulary from the public lesson/library views; preserve history. Do not delete rows. |

An active attempt started before a meaningful test/lesson update gets the existing `LISTENING_LESSON_UPDATED` conflict and must be restarted; completed answer/result snapshots remain unchanged. No deployment resubmits, resets, or regrades completed tests. Definitions and example edits do not restart listening attempts.

## API and UI boundary

All routes require the existing authenticated session:

```text
GET /api/listening/bbc/lessons
GET /api/listening/bbc/lessons/:slug/audio       # Local MP3; supports byte ranges/seeking
GET /api/listening/bbc/lessons/:slug/image       # Only the validated local cover
GET /api/listening/bbc/lessons/:slug/vocabulary  # Only this episode's entries + user progress
```

Existing test-start/submission APIs, retake behavior, sticky player, compact progress indicator, disabled Enter-submit and mistake capture are retained. Lists show cover + episode level + individual test difficulty. Both the list and test page link to the dedicated vocabulary page. Raw JSON/Markdown and answer keys have no static routes; source URLs are attribution links, not remote asset playback.

## Validation and regression tests

```bash
npm --prefix back run db:validate:listening
npm --prefix back test                     # Includes Python ZIP/tool tests; Python 3 required for development/CI
npm --prefix ui test                       # Architecture, 117+ UI unit cases, production build, PWA and CSP checks
npm --prefix ui run e2e                    # App must be running; includes episode vocabulary browser flow
```

`Listening episode integration` CI uses an ephemeral **MySQL 8.4** database to test insert/no-op/update, shared vocabulary identities, snapshots, progress, explicit archiving, transaction rollback and simultaneous deployments. Normal `node --test` deliberately skips that integration suite without `LISTENING_MYSQL_INTEGRATION=1`; never enable it on a production database. Loader tests exercise invalid metadata/difficulty/answers/files, duplicates, symlinks, transcript exclusion and semantic hash stability. HTTP tests cover authentication, image/audio boundaries, Range requests, legacy fallback and answer-key non-disclosure. Tool tests cover deterministic checksummed ZIPs, absent media/transcript, safe paths and refusal to overwrite output.
