---
name: vocora-bbc-listening-bundles
description: >-
  Find official BBC 6 Minute English episodes by exact date, inclusive date range,
  title, or official URL; prepare one validated Vocora ZIP per episode with cover,
  local audio, metadata, requested IELTS-style tests and difficulty distribution,
  episode vocabulary, and transcript/reference handling; then return the ZIP files.
  Use when the user asks to package, zip, prepare, or batch-export BBC 6 Minute
  English episodes for Vocora.
---

# Vocora BBC Listening Bundles

Prepare complete, independently validated Vocora episode bundles and return one ZIP per resolved BBC 6 Minute English episode.

`SKILL.md` is the only mandatory skill-local initial instruction file. Load `references/authoring-workflow.md` only after the request plan has been validated and at least one official episode has been resolved.

## Canonical owners

Use the skill planner/verifier for request and delivery invariants:

```bash
python3 .agents/skills/vocora-bbc-listening-bundles/scripts/bundle-request.py plan ...
python3 .agents/skills/vocora-bbc-listening-bundles/scripts/bundle-request.py verify-delivery ...
```

Use the application episode tool for actual episode validation, media fetching, transcript import, packaging, and ZIP verification:

```bash
python3 back/scripts/manage-listening-episode.py fetch-assets <episode-dir>
python3 back/scripts/manage-listening-episode.py import-transcript <episode-dir> --from <authorized-file>
python3 back/scripts/manage-listening-episode.py package <episode-dir> --output <zip>
python3 back/scripts/manage-listening-episode.py verify <zip>
```

Do not replace either owner with ad-hoc unzip/copy/checksum logic.

## When to use this skill

Use it when the user asks for any of the following:

- one BBC 6 Minute English episode ZIP for a date, title, or official URL;
- every episode in an inclusive date range, returned as separate ZIP files;
- a specified number of listening tests for each requested episode;
- a requested test difficulty mix such as one easy, two medium, and two hard tests;
- user wording such as one elementary, two intermediate, and two advanced tests, which is normalized to the application's test-difficulty contract as described below;
- a re-packaged episode bundle that must conform to Vocora's listening episode folder contract.

Do not use it for general podcast recommendations, normal UI implementation, production deployment, or unrelated vocabulary work.

## Request semantics

### Episode selection

- An exact date means the official BBC 6 Minute English episode published on that date.
- A date range is inclusive and means every official BBC 6 Minute English episode whose publication date falls inside the range.
- Do not create a ZIP for calendar dates with no episode.
- If more than one qualifying episode exists on the same date, package each episode separately.
- A title or official URL must resolve to the exact official episode and its actual publication date before authoring begins.
- Resolve relative or partial dates from the current conversation when unambiguous. If the year/month still cannot be determined safely, stop and ask for the missing date component rather than guessing.

### Test count

The requested test count applies to **each resolved episode** unless the user explicitly says the count is a total across the whole range.

If the user asks for `N` tests and gives no difficulty distribution, create all `N` as `medium`.

If the user gives a distribution, its counts must sum exactly to the requested test count for each episode.

### User wording versus canonical difficulty

The application test difficulty contract is:

- `very_easy`
- `easy`
- `medium`
- `hard`
- `very_hard`

When the user clearly uses language-course levels to describe **test difficulty**, normalize only the request wording as follows:

- elementary test -> `easy`
- intermediate test -> `medium`
- advanced test -> `hard`

This normalization does not change the episode language level. Each episode independently has exactly one language level: `elementary`, `intermediate`, or `advanced`.

Example user request:

> Prepare every episode from June 1 through June 30 with five tests each: one elementary, two intermediate, and two advanced.

Canonical per-episode test distribution:

```text
easy=1,medium=2,hard=2
```

## Workflow classification

This is a phased workflow because source discovery, semantic authoring, asset acquisition, validation, and multi-artifact delivery have different capabilities and failure modes.

```text
REQUEST_PLAN -> DISCOVERY -> AUTHORING -> ASSETS -> PACKAGE -> DELIVERY_VERIFY -> DONE
```

Each episode follows the same episode-local AUTHORING -> ASSETS -> PACKAGE path. Range requests may process independent episodes in parallel only when the environment can do so safely without mixing directories or output paths.

## Phase 1: REQUEST_PLAN

Translate the user's request into one canonical planner invocation.

Exact date:

```bash
python3 .agents/skills/vocora-bbc-listening-bundles/scripts/bundle-request.py plan \
  --date 2026-06-18 \
  --tests 5 \
  --difficulty-distribution easy=1,medium=2,hard=2 \
  --output /tmp/vocora-bbc-plan.json
```

Inclusive range:

```bash
python3 .agents/skills/vocora-bbc-listening-bundles/scripts/bundle-request.py plan \
  --from-date 2026-06-01 \
  --to-date 2026-06-30 \
  --tests 5 \
  --difficulty-distribution easy=1,medium=2,hard=2 \
  --output /tmp/vocora-bbc-plan.json
```

Do not continue if planning fails. Do not manually reinterpret a rejected date range or mismatched distribution.

## Phase 2: DISCOVERY

Resolve qualifying episodes from official BBC sources.

1. Use the official BBC 6 Minute English feed as discovery assistance when useful.
2. Confirm each selected episode against its official BBC Learning English episode page.
3. Verify title, episode date/code, canonical page URL, episode-specific image URL, direct lesson audio URL, transcript source, and introduced vocabulary before persisting metadata.
4. Never invent a URL from a date pattern and never trust a third-party podcast directory as the final authority when an official BBC source is available.
5. For a range, sort resolved episodes by publication date ascending before authoring and delivery.

If no official episode exists for an exact date, return that fact and do not fabricate a bundle.
If no official episodes exist in a range, return an empty-result explanation and do not fabricate calendar-date bundles.

After at least one episode is resolved, load `references/authoring-workflow.md`.

## Phase 3: AUTHORING

Create a task-owned staging directory outside the repository for each episode. Its folder name must follow the application contract:

```text
YYYY-MM-DD-lowercase-slug
```

Author these files in English:

```text
episode.json
listening.json
transcript.md
vocabulary.md
```

Follow `back/data/listening/episodes/README.md` as the authoritative application contract.

### Episode metadata

- Preserve a stable `publicId`, BBC episode code/date, official source URL, and source provenance.
- Select one episode language level independently from test difficulty.
- Use the source's explicit level when reliable; otherwise make a conservative editorial judgment from language density, vocabulary, speech speed, and assumed learner independence.
- Do not describe Vocora's editorial level as an official IELTS band or BBC certification unless the source explicitly provides that classification.

### Listening tests

- Create exactly the requested test count **for every episode**.
- Match the exact canonical difficulty distribution from the plan.
- Keep each test materially different. Do not duplicate questions and merely change the badge.
- Use only task types supported by the current listening episode contract.
- Keep questions in recording order where the task type permits.
- Verify every answer against the official transcript/audio reference.
- Use original IELTS-style practice questions; do not copy BBC exercises or official IELTS questions.
- Make distractors plausible but unambiguous.
- Keep all prompts, instructions, options, accepted answers, headings, and test titles in English.
- Keep IDs unique and stable inside the episode package.

### Vocabulary

- Use the small set of words/collocations actually introduced by the episode.
- Follow the same vocabulary identity/definition/example model used by file-managed collections.
- Write concise original English definitions and natural original English examples.
- Each listed episode vocabulary item must have at least one definition and one example.
- Do not copy BBC definitions verbatim when an independently worded explanation is practical.

### Transcript handling

The transcript file is required but is never synchronized to the database.

- The official BBC transcript may be used as an authoring reference.
- Do not reproduce a full copyrighted transcript into the deliverable unless the user supplied an authorized local copy or the task has a clearly valid right to redistribute it.
- Without an authorized full transcript, create the repository-standard `TRANSCRIPT_SOURCE_ONLY` reference file containing the official transcript source URL and disclose that the bundle is source-reference-only.
- When the user supplies an authorized transcript file, import it with the canonical application tool rather than hand-copying it.

## Phase 4: ASSETS

Record only verified official BBC media URLs in `episode.json.sources`, then use:

```bash
python3 back/scripts/manage-listening-episode.py fetch-assets <episode-dir>
```

This must download the episode-specific cover and direct lesson MP3 into the staging directory.

- Do not substitute a generic show cover when an episode-specific image exists.
- Do not substitute podcast-feed audio with materially different timing when a direct lesson MP3 is available.
- Preserve source provenance.
- Never commit MP3 or generated ZIP files to Git.

If source fetching fails, fix the verified source metadata or report the blocker. Do not create fake audio/image bytes or bypass media validation.

## Phase 5: PACKAGE

Run the application validator before packaging.

For an authorized full transcript:

```bash
python3 back/scripts/manage-listening-episode.py package <episode-dir> \
  --output <output-dir>/<episode-folder>.zip
```

For a disclosed source-reference-only transcript:

```bash
python3 back/scripts/manage-listening-episode.py package <episode-dir> \
  --allow-source-transcript \
  --output <output-dir>/<episode-folder>.zip
```

Create exactly one ZIP per episode. Do not create one combined archive unless the user explicitly asks for an additional aggregate archive.

Use an output directory outside the repository. Never add generated ZIPs or MP3s to Git.

## Phase 6: DELIVERY_VERIFY

After all episode ZIPs exist, verify the complete delivery against the original plan in one command:

```bash
python3 .agents/skills/vocora-bbc-listening-bundles/scripts/bundle-request.py verify-delivery \
  --plan /tmp/vocora-bbc-plan.json \
  <episode-1.zip> <episode-2.zip> ...
```

This verification must pass before files are handed to the user. It checks the canonical application bundle verifier plus date bounds, unique episode identities, exact per-episode test count, and exact difficulty distribution.

If final verification fails, fix the affected episode and repackage it. Do not hand-wave the mismatch or manually declare the delivery valid.

## Delivery response

Return each ZIP as a separate downloadable artifact/link and summarize, for each episode:

- publication date;
- title;
- episode language level;
- test count and difficulty distribution;
- transcript status (`full/provided` versus `source reference only`).

For a date range, preserve chronological order in the response.

Do not say that the task is complete until every returned ZIP passed final delivery verification.

## Stop conditions

Stop with a clear blocker instead of inventing data when:

- the requested date cannot be resolved unambiguously;
- an official episode cannot be confirmed;
- required media URLs cannot be verified or fetched;
- requested test counts/difficulty distribution are inconsistent;
- the official reference is insufficient to verify answers;
- the canonical episode validator rejects authored content;
- packaging or final delivery verification fails.

## Determinism Boundary

### Script-owned

- Validate exact-date/range inputs and date ordering.
- Validate requested per-episode test count and canonical difficulty distribution.
- Persist the canonical request plan.
- Run the application bundle verifier for each delivered ZIP.
- Inspect delivered episode metadata/tests and verify date bounds, unique identities, exact test count, and exact difficulty counts.
- Produce stable machine-readable planning and final-delivery reports.

### Agent-owned

- Interpret natural-language dates and user intent into canonical planner arguments.
- Resolve official BBC episodes and source URLs.
- Decide episode language level when the source does not provide an authoritative level.
- Author original IELTS-style questions, answers, distractors, vocabulary definitions, and examples.
- Judge whether source evidence is sufficient to verify each answer.
- Decide whether an authorized full transcript is available or a source-reference-only bundle must be disclosed.
- Present the verified ZIP files to the user.

### No manual fallback

- Do not bypass a planner failure by manually constructing a different request plan.
- Do not bypass `manage-listening-episode.py` validation, packaging, or ZIP verification.
- Do not bypass `verify-delivery` by manually counting tests or asserting a date range is correct.
- Do not invent BBC metadata, URLs, transcript text, answers, media, or missing episodes when a required source cannot be verified.
