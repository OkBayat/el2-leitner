---
name: k2-bbc-listening-bundles
description: >-
  Find, author, revise and validate BBC 6 Minute English episodes for Vocora;
  prepare separate episode ZIPs by date, range, title or official URL with the
  requested test counts and difficulty distribution. Use also when reviewing
  or redesigning existing IELTS-style listening questions or their authoring rules.
---

# K2 BBC Listening Bundles

Prepare source-grounded IELTS-style practice and independently validated episode bundles. For content revisions, preserve existing episode identities, test routes and completed attempts and deliver the requested separate PR instead of manufacturing new episode ZIPs.

`SKILL.md` is the initial router and invariant contract. Read the root `AGENTS.md` first. The application schema remains authoritative in `back/data/listening/episodes/README.md`.

## Mandatory question-design gate

BEFORE writing or revising a single question, read `references/ielts-question-design.md`, then the current schema and `references/authoring-workflow.md`. Research official IELTS/British Council/IDP guidance when changing the rules. Do not reconstruct the rules from memory or copy Reading task types into Listening.

The IELTS Listening test has four parts with exactly TEN questions per part (40 overall), and the questions follow the order of information in the recording. Vocora mirrors that count: EACH BBC practice test must contain exactly TEN scored questions. These BBC exercises are IELTS-style practice, not official papers or calibrated band estimates.

Every newly authored or redesigned test MUST:

- contain exactly 10 genuine, non-duplicate scored questions; headings and answer alternatives do not count;
- use all four currently implemented task types: `note_completion`, `multiple_choice_single`, `sentence_completion`, `short_answer`;
- group related tasks coherently, normally 3 + 3 + 2 + 2 when all four currently supported task types are used, with globally consecutive question numbers 1–10;
- follow the actual audio chronology across the ENTIRE test, including group transitions, with verified private source evidence for every question;
- test meaningful information in the discussion, not pad the count with greetings, presenter names, generic definitions or closing advertisements;
- use original natural English prompts, grammatical completions, unambiguous source-supported answers and fair distractors;
- use A/B/C with exactly one correct answer in single-choice tasks, and explicit word/number instructions consistent with the scoring limits for text tasks;
- remain materially distinct from the other tests for the same episode;
- pass both the canonical application validator and its question-quality gate, followed by a semantic review against the official reference.

Easy means mostly explicit local detail with familiar language, NOT fewer questions or absurd distractors. Medium requires meaningful paraphrase and detail selection. Hard requires substantial synonym/paraphrase recognition and evidenced distinctions such as cause/result, qualification, attitude or contrasting explanations. At least half of a hard test must genuinely require paraphrase recognition and at least two items must test such distinctions. These thresholds are Vocora editorial policy, not IELTS regulations. Never make a test hard through ambiguity, invented facts, unrelated rare words or an answer that is not in the recording. Completion answers remain recording words; paraphrase the surrounding prompt instead.

The full official task-family catalogue, supported/unsupported mapping, per-type rules, difficulty rubric, source-evidence requirements and review checklist live in `references/ielts-question-design.md`. Do not invent unsupported matching, map, diagram, multi-select or table renderers. Do not use True/False/Not Given as an IELTS Listening task.

## Canonical owners

Use the skill planner and final delivery verifier:

```bash
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py plan ...
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py bind-discovery ...
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py verify-delivery ...
```

Use the application tool for episode/media operations:

```bash
node back/scripts/record-listening-question-review.js --episode <episode-dir> --confirm-reviewed --require-audio
node back/scripts/validate-listening-lessons.js --episode <episode-dir> --require-audio
python3 back/scripts/manage-listening-episode.py fetch-assets <episode-dir>
python3 back/scripts/manage-listening-episode.py import-transcript <episode-dir> --from <authorized-file>
python3 back/scripts/manage-listening-episode.py package <episode-dir> --output <zip>
python3 back/scripts/manage-listening-episode.py verify <zip>
```

The canonical validation path must enforce the question-quality gate before packaging. Do not replace it with ad-hoc counting, unzip/checksum logic or a claim that JSON parsing succeeded. Script validation cannot certify pedagogy; semantic source review is separately mandatory. Only AFTER that review, use `record-listening-question-review.js --confirm-reviewed` to bind the authored evidence and content. The command does not create evidence or independently certify it; see the application README for the file-only metadata contract.

## Request semantics

- An exact date means the officially published BBC episode for that date, not a made-up daily episode.
- An inclusive range means every qualifying official episode between those dates. Return one ZIP per episode, including distinct episodes on the same date.
- A title/URL must resolve to an exact official identity and publication date.
- A latest-N request first checks the repository catalog, excludes existing identities and any explicitly excluded prior deliveries, and selects by verified publication date. Do not claim to have checked a production database unless it was actually queried.
- Test counts and difficulty distributions apply to EACH selected episode unless the user explicitly requests a total across episodes.
- With no count, create one `medium` test. With a count but no mix, create that many `medium` tests. Each test still requires exactly ten questions and all four currently supported task types.
- Difficulty counts must sum exactly to the requested test count.
- Course-level wording for TEST difficulty normalizes as elementary -> `easy`, intermediate -> `medium`, advanced -> `hard`. The full application enumeration is `very_easy`, `easy`, `medium`, `hard`, `very_hard`.
- Episode language level remains independently `elementary`, `intermediate` or `advanced`; never derive it from a test badge.
- Keep existing test counts, public episode IDs, slugs and test IDs when the request only redesigns questions. Content revisions must not delete learner history.

## Workflow

```text
REQUEST_PLAN -> DISCOVERY -> DISCOVERY_BIND -> DESIGN_POLICY -> AUTHORING -> QUALITY_REVIEW -> ASSETS -> PACKAGE -> DELIVERY_VERIFY -> DONE
```

For existing-content revisions: `CATALOG_AUDIT -> DESIGN_POLICY -> AUTHORING -> QUALITY_REVIEW -> REGRESSION_TESTS -> NEW_PR`. Read and record the policy BEFORE authoring. Do not require a fake discovery plan or generate ZIPs when the user requested only a PR.

### 1. Request plan

For an exact date:

```bash
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py plan \
  --date 2026-06-18 --tests 5 \
  --difficulty-distribution easy=1,medium=2,hard=2 \
  --output /tmp/k2-bbc-plan.json
```

For an inclusive range:

```bash
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py plan \
  --from-date 2026-06-01 --to-date 2026-06-30 --tests 5 \
  --difficulty-distribution easy=1,medium=2,hard=2 \
  --output /tmp/k2-bbc-plan.json
```

Do not hand-edit a rejected plan, guess missing dates, or silently change the requested distribution.

### 2. Discovery and binding

Use the official BBC feed for discovery assistance and confirm each identity against its official Learning English page. Verify title, publication date/code, canonical source URL, episode-specific image, direct lesson MP3, transcript source and introduced vocabulary. Never invent asset URLs from naming patterns. Prefer official source facts over third-party directories. Sort the result by publication date.

Bind every and only resolved episode before authoring:

```bash
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py bind-discovery \
  --plan /tmp/k2-bbc-plan.json \
  --episode 2026-06-18=bbc-6-minute-english-260618 \
  --episode 2026-06-25=bbc-6-minute-english-260625 \
  --output /tmp/k2-bbc-bound-plan.json
```

Do not fabricate bundles for dates without episodes or omit an episode to reduce work. Explain a verified empty result honestly.

### 3. Authoring and quality review

Read the mandatory design reference. Follow `references/authoring-workflow.md` for phase details. Use a task-owned `YYYY-MM-DD-lowercase-slug` staging directory outside Git for each new episode. Author `episode.json`, `listening.json`, `transcript.md` and `vocabulary.md` in English.

Review the complete source and build an answer timeline before prompts. Verify each answer location against the actual lesson audio/reference and preserve forward-only order between all groups. The ten-question IELTS-aligned blueprint is not permission to repeat the same ten questions under five different titles. Use different listening targets or materially different comprehension operations, and compare the finished variants.

Write concise original definitions and natural original examples for the small set of vocabulary actually introduced. Every item requires both a definition and an example under the collection contract.

`transcript.md` stays file-only. Do not reproduce a full copyrighted transcript unless the user supplied an authorized local copy or a clearly valid redistribution right exists. Otherwise use `TRANSCRIPT_SOURCE_ONLY` with the official URL and disclose that it is a reference, not a full transcript. Import authorized local text with the application tool.

### 4. Assets

Record verified BBC source URLs, then run `manage-listening-episode.py fetch-assets`. Fetch the actual episode cover and direct lesson MP3. Do not substitute a generic show image, a different podcast edit or fake media. Do not overwrite existing local audio automatically. Never commit MP3s or generated ZIPs.

### 5. Package and delivery verification

Package each episode separately outside Git. For a disclosed source-reference transcript use:

```bash
python3 back/scripts/manage-listening-episode.py package <episode-dir> \
  --allow-source-transcript --output <output-dir>/<episode-folder>.zip
```

For authorized full text, omit `--allow-source-transcript`.

Verify the entire delivery set against the bound plan:

```bash
python3 .agents/skills/k2-bbc-listening-bundles/scripts/bundle-request.py verify-delivery \
  --plan /tmp/k2-bbc-bound-plan.json <episode-1.zip> <episode-2.zip>
```

This must pass along with the canonical question-quality checks. Fix/repackage failures. Return each final ZIP separately, chronologically, stating date, title, episode level, test count/mix, questions PER test and actual transcript status. Do not present internal source/media artifacts as installable finished bundles. Do not say complete when only structure checks passed or a known required file is missing.

## Stop conditions

Stop with a precise blocker rather than inventing facts when identity/date, official assets, answer support or audio chronology cannot be verified; when requested counts conflict; when the source cannot support the required distinct high-quality questions; or when canonical validation, quality checks, packaging or delivery verification fails. Never lower the question count, fabricate evidence, suppress tests or relabel copied variants to force a pass.

## Determinism Boundary

### Script-owned

- Validate dates, requested counts/mix, discovery binding, exact delivered identities, canonical JSON/media/ZIP contracts, exact ten-question count, supported task diversity, numbering, IDs, option shape, answer limits, duplicate prompts, source-evidence order/range/audio identity and scoring regression fixtures. Run focused skill tests, the skill validator and affected application tests. Report actual results, not assumed success.

### Codex-owned

- Resolve official sources; interpret the request; verify source meaning and answer locations; write original coherent tests, fair distractors, vocabulary and examples; judge actual paraphrase and difficulty; confirm distinctness and sensible pacing; decide transcript authorization; and honestly present artifacts or PR results. Automated labels cannot replace this review.

### No manual fallback

- Do not bypass planning, binding, the application validator, question-quality gates, package/ZIP verification or final `verify-delivery`. Do not manually assert completeness, manufacture timestamps, invent missing media/answers, weaken an unrelated regression test, or substitute a badge for real difficulty. Repair deterministic tooling under test when necessary; never silently opt out.
