# IELTS Implementation Direction

> Status: **approved-for-planning direction; not implemented or deployed by this document**.
> Decision recorded: 2026-09-12. Source baseline: `a96fe551421910d28890b01a17822544002b124b` on `main`.

## Start here

The [curriculum README](README.md) defines what learners practise. The existing
[enterprise architecture playbook](../ARCHITECTURE_PLAYBOOK.md) remains the
technical playbook for repository architecture, migration, deployment, testing,
and ownership. It already exists and is deliberately not duplicated or rewritten.

The new [self-hosted Writing feedback plan](WRITING_FEEDBACK.md) and the general
[adaptive conversation design](../docs/ADAPTIVE_CONVERSATION.md) apply that
playbook to the next IELTS implementation direction: **deterministic checking for
closed tasks, local Qwen feedback for open text, existing Kokoro for TTS, and
reuse of the current browser PCM/Vosk boundaries for conversational practice**.

The course's numbered lessons, targets, prerequisites, counts, reference packs,
and blocked production status remain unchanged. These implementation companions
are not new lessons, generated slide objects, evidence of model quality, or a
replacement for the curriculum's authoring/runtime compiler.

## Decision and limits

| Concern | Direction | Boundary |
| --- | --- | --- |
| Closed-answer practice | Keep existing server-owned keys and exact/structured validators | Do not replace reliable grading with an LLM |
| Open Writing and short explanations | Evaluate `Qwen3-4B-Instruct-2507` through private Ollama | A candidate for evidence-based formative feedback, not a validated IELTS examiner |
| Initial deployment target | CPU-only HP Gen8-class servers; no GPU dependency | Exact CPU, ISA support, available RAM, latency and concurrency must be measured |
| Output | Schema-validated JSON with relevant source quotes, minimal corrections and brief explanations | Valid JSON does not establish correct language judgment |
| TTS | Retain Kokoro and the existing authenticated TTS boundary | The selected Qwen model is text-only and does not replace Kokoro |
| Speaking now | Retain existing Vosk/Shadowing behavior | Repetition/word recognition is not independent Speaking assessment |
| Adaptive conversation | General JSON slide: browser PCM -> private Vosk -> local Qwen turn feedback/question -> existing Kokoro playback | Transcript-only feedback cannot assess pronunciation, fluency, or a full Speaking performance |
| Scores | Keep deterministic task results; begin AI feedback qualitatively | Withhold numeric IELTS estimates until external calibration and release approval |

This direction supersedes a **deterministic-only restriction on open-response
feedback**, not the deterministic ownership of authentication, constraints,
closed-answer scoring, persistence, progression or Leitner scheduling.

## Delivery order

Each row is a future independently reviewable implementation slice. Nothing in
this list marks the slice complete or authorizes a deployment.

| Slice | Deliverable | Acceptance condition |
| --- | --- | --- |
| WF-01 | CPU/model feasibility and feedback-quality experiment | Real target-host measurements and reviewed examples support a bounded pilot; no claimed performance from model size alone |
| WF-02 | Versioned task, draft and feedback contracts | Original response persists before evaluation; private task context is authoritative; failure and abstention are not wrong answers |
| WF-03 | Private Ollama adapter and bounded worker | Authenticated backend access only, pinned model/runtime identity, bounded resources, validated responses and no cloud fallback |
| WF-04 | One complete Writing feedback/revision loop | Reuse `writing-response`; show actionable feedback, preserve drafts and retry safely without false mastery |
| WF-05 | Wider curriculum coverage | Open summaries/explanations and longer Writing tasks pass task-specific quality and capacity gates; Task 1 has authoritative textual visual data |
| WF-06 | Optional calibrated score estimates | Held-out independently rated responses validate the exact model/prompt/quantization/rubric version; limitations remain visible |
| WF-07 | Separately scoped speaking-text feedback | A suitable recording/ASR contract exists; transcripts and corrected playback never stand in for acoustic assessment |
| AC-01 | General adaptive-conversation contract and persisted turn workflow | No IELTS-specific component; server-owned JSON context, bounded recording/inference and verifiable completion evidence |
| AC-02 | L0001 E09 as the first JSON consumer | Two accepted turns, validated Qwen question generation, owned ephemeral Kokoro playback and no IELTS-band claim |

Start with the [L0001 reference pack](examples/EX01.md) and a small set of newly
authored alternative responses. Preserve its personal meal-writing objective:
learners need not repeat the model's chosen foods or facts. The public reference
pack is teaching material, not an unseen readiness test. Keep the wider four-skill
pilot and compiler work from curriculum sections 13 and 16 in scope for course
release; an inference service alone does not unblock all 960 lessons.

## Relationship to existing plans

- Curriculum sections **10.2 and 10.4** remain the feedback and calibration
  requirements; `WRITING_FEEDBACK.md` supplies a candidate implementation.
- Curriculum sections **8 and 13.3** retain original-attempt, repair, fresh-transfer
  and completion/mastery distinctions. Qwen cannot mutate Leitner or award a pass.
- The architecture playbook's **sections 3, 9, 11 and 12**, and **WP-10/WP-11**,
  remain the relevant dependency, evidence, security and operations boundaries.
  This plan does not assert that the NestJS/PostgreSQL migration is complete or
  make it an implicit prerequisite for a feedback prototype using current ports.
- Existing [TTS](../docs/TTS.md) and [Shadowing](../docs/SHADOWING.md) own their
  provider behavior. Do not create a parallel TTS cache or shadowing scorer.

## Source and generation discipline

Keep implementation decisions in these hand-authored companion documents. Do not
paste provider configuration into the provisional lesson JSON, turn
`AUTHORING BRIEF` text into learner prompts, or replace open-response objectives
with exact matching merely to make them appear runnable.

The imported curriculum's `README.md`, `README.html`, `scripts/README-front.md`,
`data/`, `stages/`, `examples/` and existing `audit/` outputs are preserved. Its
manifest and validation report describe the original generated package, not a
validation of these later implementation companions. A later intentional package
release must regenerate its own manifest and any derived documents with the
owning scripts; it must not advertise inherited counts as new validation.

This documentation change installs no model, changes no runtime/Compose/database
file, starts no service, and changes neither repository protection nor OKF.
