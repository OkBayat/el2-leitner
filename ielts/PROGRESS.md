# IELTS course production

Base: `codex/ielts-slide-system` at `436706ec851f76240602d243bc6acb471e8c219e`.
Working branch: `codex/ielts-production-course`. Keep one PR against that base.
Every reference to `learning-path` in the accepted production prompts means this
base branch. Do not move the work to `main` or create a second course PR.

## Current checkpoint

- Stage: S01, foundation. Current lesson: **L0001 Golden Lesson candidate**.
- Last fully production-ready lesson under the complete requested feedback and
  conversation contract: **none**. Do not report the whole course complete.
- L0001 authored checkpoint: 14 runtime exercises, including intake, and 106
  configured slides. The intake also generates its own vocabulary screens.
  Complete teaching source: [lessons/L0001.md](lessons/L0001.md).
- Next: resolve the Golden Lesson feedback/conversation gates below, validate
  the complete experience, then author L0002. Do not mass-generate later lessons
  while the reference implementation still has these gaps.
- The remaining 959 blueprint lessons are not runtime lessons and have no
  completed production teaching documents. No fixed lesson total is mandatory.

## Audit and source ownership

| Source | Actual role |
|---|---|
| `data/lesson_plans.jsonl`, indices, stage files and generated README | 960 provisional curriculum designs and authoring briefs; preserved research baseline |
| `examples/EX01.md` and other reference packs | Original authored teaching assets; not proof of complete runtime lessons |
| `back/data/learning-paths/ielts.json` | The file-managed JSON actually loaded by the application; currently contains L0001 |
| `back/data/collections/ielts.md` | L0001's eight-item vocabulary section; source for intake and Leitner |
| `lessons/L0001.md` | Complete human-readable educational companion for the current runtime lesson |
| `IMPLEMENTATION.md`, `WRITING_FEEDBACK.md`, `docs/ADAPTIVE_CONVERSATION.md` | Existing implementation direction and engineering gates; not deployed feedback behavior |

The expanded lesson preserves all original runtime lesson, exercise and slide
IDs and the eight-item vocabulary scope. Added listening at position 75 uses
the registered `dialogue` stimulus and `structured-completion` interaction.
Position 90/E09 stays reserved by the existing adaptive-conversation plan. The
original blueprint called E09 listening integration; the new listening exercise
supplies that comprehension objective without claiming conversation is built.
Final mixed retrieval is at position 140. These counts are not templates for
later lessons.

## Golden Lesson changes

- Teach vocabulary categories, pronouns, statement order, phrases, text support
  and TRUE/FALSE/NOT GIVEN before testing them.
- Replace underdetermined meal gaps with meaning cues or genuine accepted
  alternatives. Comprehension permits capital-letter answers; the dedicated
  punctuation task requires exact capitals and its full stop.
- Use an original, hidden-script two-speaker listening form with grouped
  submission and a post-answer transcript. Kokoro is the primary existing
  speech path; browser synthesis remains the current runtime fallback.
- Add guided, independent and revised speaking/writing responses using distinct
  existing submission contracts. Checklists are explicitly self-review.
- Fix the sequence recording lifetime so recorder destruction cannot revoke
  the only copy before upload. Keep learner recordings out of course JSON.
- Add a validator that uses the actual course parser and exercise validator,
  checks globally unique identities and lesson Markdown, and rejects stale
  JSON/Markdown checksums. It does not assess teaching quality.

## Blocking release gates

1. **Qwen Writing:** Ollama/model provisioning exists, but no backend inference
   adapter, authoritative task/rubric consumer, feedback API or feedback/revision
   application workflow exists. Current `writing-response` records submitted
   text and can show a static model. The new separate revision slide records a
   second response; it does not automatically compare drafts or evaluate them.
2. **Adaptive Speaking:** the planned `adaptive-conversation` session/API and
   its PCM → Vosk → Qwen → Kokoro orchestration are not registered or implemented.
   Independent recording is not conversational feedback or acoustic assessment.
3. **Quality evidence:** WF-01 requires actual target-CPU measurements and
   reviewed model outputs before a supported feedback pilot. No target-host
   benchmark or reviewed quality result was available in this task. Content
   validation cannot supply that evidence. See the existing feedback playbook.

Do not add unused evaluator metadata, invent an endpoint, count submitted text
as mastery, or publish a fake E09 to conceal these gaps. The accepted request
permits the smallest necessary generic extension, but release claims still need
working consumers and actual validation. This checkpoint improves authored
content while the full Golden Lesson remains blocked.

## Continuing authoring

Follow the existing curriculum and `k2-lesson-exercise-design` for source targets
and prerequisites, and `k2-exercise-builder` for every exact runtime exercise.
Use the current implementation playbook; do not create another architecture.

For each lesson: targeted research → instruction and practice → runtime JSON →
complete matching Markdown → content/answer review → validators and affected
tests → reviewed commit → push → next lesson. Keep the Markdown in the same
lesson commit. Use original examples. Record CEFR and IELTS labels separately.
Do not put podcast instructions or scripts in lesson teaching files.

Run from the repository root:

```bash
python3 ielts/scripts/validate_runtime_course.py
python3 -m unittest discover -s back/tests/tooling -p test_ielts_runtime_course.py
node --test back/tests/collection-learning-path-ielts-source.test.js
```

The Markdown integrity marker is SHA-256 of its lesson object encoded as UTF-8
with `json.dumps(lesson, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`.
Refresh it only after reviewing the changed JSON and teaching file together.
Changing only the hash is not a content review. The legacy blueprint validator
still validates its historical package; it does not validate the runtime course.

Before resuming, read this checkpoint, the PR and recent commits. Continue on
the existing working branch. Preserve already published history and learner IDs.
