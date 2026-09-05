# BBC Episode Authoring Workflow

Load this reference only after the request plan is valid and at least one official BBC episode has been resolved.

The authoritative application contract remains `back/data/listening/episodes/README.md`. This reference explains agent execution order and quality checks; it does not replace the application schema.

## Episode workspace

Create one task-owned staging directory outside the Git repository for each episode:

```text
<workspace>/
└── YYYY-MM-DD-lowercase-slug/
    ├── episode.json
    ├── listening.json
    ├── cover.jpg
    ├── audio.mp3
    ├── transcript.md
    └── vocabulary.md
```

Do not stage generated MP3 or ZIP files inside the repository. The application validator accepts an episode directory outside the catalog as long as its folder/file contract is valid.

## Official source resolution

Use official BBC sources as final authority.

For each candidate episode, confirm all of the following before authoring:

- exact title;
- official publication date;
- BBC episode code when present;
- official Learning English episode page;
- episode-specific cover/hero image URL;
- direct lesson audio URL;
- official transcript page/PDF URL when available;
- vocabulary items introduced by the episode.

The public podcast feed may be used to discover candidates, but the official episode page should confirm the final metadata and lesson assets.

Do not infer an asset URL from a naming convention merely because neighboring episodes use a similar pattern. Follow the actual page links or official feed metadata and verify the response content through the canonical asset-fetch tool.

## Episode identity

For a new episode, use a stable public identity consistent with existing BBC episodes, for example:

```text
bbc-6-minute-english-260618
```

Use the real BBC episode code when the source provides one. Keep the identity stable if regenerating the same episode later.

The folder name is a storage location, not the primary identity.

## Episode metadata quality

`episode.json` must use the current application schema.

Before validation, review:

- `episodeDate` exactly matches the official date and folder prefix;
- `sourceUrl` is the canonical official episode page;
- `sources.audioUrl` points to the verified direct lesson audio;
- `sources.imageUrl` points to the episode-specific image;
- `sources.transcriptUrl` points to the official transcript source when available;
- `level` is one of `elementary`, `intermediate`, `advanced`;
- `audioFile` is `audio.mp3`;
- `imageFile` matches the actual image filename and bytes;
- `status` is appropriate for the requested deliverable.

Do not put full transcript text, answer keys, remote playback behavior, or database IDs in `episode.json`.

## Episode language level

Prefer an explicit trustworthy source level when one exists. Otherwise choose conservatively:

- `elementary`: slower, highly explicit language with common vocabulary and low inference burden;
- `intermediate`: normal 6 Minute English density with moderate paraphrasing and topic vocabulary;
- `advanced`: dense abstract language, fast information delivery, specialized vocabulary, or high inference burden.

This is an editorial Vocora level unless the source explicitly states otherwise.

## Test authoring sequence

Read/listen through the full episode before writing questions. Build a compact private fact timeline first; do not persist copied transcript passages in the repository or output package.

For each requested test:

1. Assign the exact canonical difficulty from the validated request plan.
2. Choose supported task types from the current application contract.
3. Select a coherent span of the recording and keep questions in audio order.
4. Write original prompts and distractors.
5. Verify every answer against the official audio/transcript reference.
6. Check accepted spelling/number variants against the answer-limit instruction.
7. Ensure IDs are unique across the entire episode.
8. Ensure the test is materially distinct from the other tests.

A difficulty badge alone does not make a test easier or harder.

### Difficulty guidance

- `very_easy`: direct wording, strong lexical overlap, obvious location in the recording.
- `easy`: mostly explicit facts with limited paraphrasing.
- `medium`: moderate paraphrase and information selection.
- `hard`: denser detail, plausible nearby distractors, or greater paraphrase.
- `very_hard`: subtle distinctions and demanding selection while remaining objectively answerable.

Do not introduce ambiguity merely to increase difficulty.

## Test coverage and uniqueness

Across multiple tests for the same episode:

- vary task types when the source supports it;
- vary which episode segments are emphasized;
- avoid repeated prompts with cosmetic changes;
- avoid using the exact same answer sequence in multiple tests;
- keep all questions grounded in the recording, not general knowledge;
- preserve the requested difficulty counts exactly.

If the recording cannot support the requested number of distinct high-quality tests, stop and report that limitation instead of duplicating weak tests.

## Vocabulary authoring

Use the vocabulary/collocations actually introduced by the BBC episode.

Write `vocabulary.md` using the current file-managed collection format:

```markdown
# Episode title — Vocabulary

## Episode vocabulary

- example term
  - definition: A concise original English definition.
  - example: A natural original sentence using the term.
```

Every item needs at least one definition and one example. Keep examples independent from the BBC transcript and suitable for later sentence practice.

## Transcript file

When no authorized full transcript is available, write only a source-reference placeholder:

```markdown
# Episode title — Transcript source

TRANSCRIPT_SOURCE_ONLY

Official transcript: https://...
```

Do not label this as a full transcript.

When the user supplies an authorized local transcript, import it with:

```bash
python3 back/scripts/manage-listening-episode.py import-transcript \
  <episode-dir> --from <authorized-transcript.md>
```

Do not copy a full web transcript into the deliverable merely because it is publicly readable.

## Asset acquisition

After metadata is final:

```bash
python3 back/scripts/manage-listening-episode.py fetch-assets <episode-dir>
```

Inspect the reported file sizes and checksums. Do not replace a failed download with a manually fabricated file.

## Pre-package review

Before packaging each episode, check:

- official date/title/source identity are correct;
- episode language level is set;
- test count equals the request;
- difficulty counts equal the request;
- every test is IELTS-style and uses supported task types;
- all answers were verified;
- vocabulary is episode-specific and has definitions/examples;
- cover and MP3 are real validated media;
- transcript status is honestly represented;
- all engineering/content files authored by the agent are in English.

Then package with the canonical application tool and run final multi-bundle verification from `SKILL.md`.
