# BBC Episode Authoring Workflow

For new bundles, load this reference after valid planning and official discovery binding. For an existing-content revision, load it after auditing the current catalog. In BOTH workflows, read `ielts-question-design.md` BEFORE authoring questions; its per-test rules are mandatory.

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

Read the full official reference and check the actual lesson recording before writing questions. Build a private answer timeline first. Do not persist copied transcript passages or ASR output in Git or the output package.

For each requested test:

1. Preserve its existing route/identity and requested difficulty, or assign a unique new identity for a genuinely new test.
2. Select exactly TEN worthwhile, non-duplicate information targets. Do not count headings, options or accepted-answer variants as questions.
3. Arrange them in forward audio order through the whole test, including group transitions. Use all FOUR implemented task types in coherent groups, normally 4 + 3 + 3 + 3 questions.
4. Write original notes, sentences, short-answer prompts and A/B/C options. Check naturalness, relevance, grammatical completions, clear answer limits and fair distractors.
5. Verify every answer against the official reference and its actual audio interval. Record private `sourceReview`/`evidence` metadata as described in the application README. These are file-only review data, not learner hints or database fields.
6. Apply the full difficulty rubric in `ielts-question-design.md`: easy is mostly explicit detail; medium has meaningful paraphrase; hard has substantial paraphrase plus evidenced distinctions. All levels keep the same count, diversity and correctness standards.
7. Compare variants: they must differ in listening targets or operations, not merely wording, order or a difficulty badge. Avoid duplicate prompts and answer sequences, and avoid repeating one source fact within a test.
8. Test accepted spellings/number forms and rejected/over-limit responses with the actual scorer. Review the whole test semantically, not only as JSON.
9. After that review, record its digest with the canonical command and validate:

```bash
node back/scripts/record-listening-question-review.js \
  --episode <episode-dir> --confirm-reviewed --require-audio
node back/scripts/validate-listening-lessons.js --episode <episode-dir> --require-audio
```

The confirmation command does not invent evidence, certify language quality or change the supplied audio identity. It rejects invalid evidence before writing and binds the reviewed content with a deterministic hash. Without local media, a repository-only review may omit `--require-audio`; that does NOT verify the actual audio bytes. Packaging and final delivery must check actual media.

### Difficulty guidance

Follow `ielts-question-design.md` for the detailed task-specific rubric, source links and required editorial thresholds. IELTS has ten questions per part; Vocora now mirrors that exact count for each BBC practice test. Synonyms/paraphrase normally belong in the prompt/options; completion answers must remain words heard in the recording.

### Test coverage and uniqueness

Every test needs exactly ten questions, all four currently supported types, substantive beginning/middle/later coverage and strictly forward answer locations. Distinct tests may reuse source facts only for materially different listening operations. Do not pad missing questions with greetings, presenter names, advertisements or disconnected dictionary exercises. If the recording cannot support the requested high-quality variants, resolve that limitation rather than duplicate weak tests or lower the minimum.

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
- every test has exactly ten scored questions and all four currently supported task types;
- consecutive numbering, answer limits and private source-evidence chronology pass the quality gate;
- source review is current and tied to the actual lesson audio hash;
- all answers were verified;
- vocabulary is episode-specific and has definitions/examples;
- cover and MP3 are real validated media;
- transcript status is honestly represented;
- all engineering/content files authored by the agent are in English.

Then package with the canonical application tool and run final multi-bundle verification from `SKILL.md`.
