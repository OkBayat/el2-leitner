# Vocora Agent Notes

Read the repository root `AGENTS.md` first. It is the repository-wide source of truth.

## Skill routing

Use the smallest applicable existing skill.

- `k2-principles`: mandatory once at the start of every mutation task before any code, docs, tests, configuration, workflow, architecture, schema, contract, data-model, migration, or agent-skill change. Select only the smallest relevant principle set, read only those references, state why each applies, then return execution to the owning workflow. Read-only investigation, explanation, and review do not require it unless a mutation is requested.
- `k2-skill-architecture`: mandatory after `k2-principles` when creating, changing, moving, or deleting a skill or shared skill asset. It owns skill boundaries, deterministic ownership, phased-workflow structure, and skill architecture validation.
- `k2-skill-script-architecture`: additionally mandatory before changing executable JavaScript or TypeScript under `.agents/skills/**/scripts/**`. It owns module limits, dependency-cycle checks, and script architecture validation.
- `k2-okf-update`: explicit-only. Use only when the user explicitly asks to add, refresh, or review durable project knowledge in the root `okf/**` bundle. It owns OKF concepts, indexes, logs, and validation; never import another repository's project-specific knowledge.
- `k2-task-delivery`: use for multi-stage implementation requests that span several behaviors, contracts, files, test surfaces, documentation changes, or authorized publication gates.
- `k2-worktree-first`: explicit-only. Use only when the user directly names `k2-worktree-first` or `$k2-worktree-first`; do not infer it from ordinary isolation or branch intent.
- `k2-pre-push-review-loop`: use when an owning workflow requires an exact-range, identity-bound review before authorized publication. It routes review requests through `k2-requesting-code-review` and feedback evaluation through `k2-receiving-code-review`.
- `k2-bbc-listening-bundles`: use when the user asks to find, prepare, validate, or return one or more BBC 6 Minute English episode ZIP bundles by exact date, inclusive date range, title, or official episode URL. Also use it to review or redesign existing BBC listening questions and their quality rules; read its IELTS design reference before authoring. It owns multi-episode discovery orchestration, exact requested test counts/difficulty distribution, episode assets, episode vocabulary, source-reference/full-transcript handling, canonical packaging, and one-ZIP-per-episode delivery.
- `k2-exercise-builder`: mandatory whenever an individual exercise or exact slide sequence is designed, authored, configured, or materially revised. It owns runtime-ready `app-slides-sequence-exercise` objects, existing-slide selection, per-slide data, terminal flow, and deterministic validation. It must stop when no registered reusable slide has the required interaction and evidence semantics; it never creates slide types or components. When `k2-lesson-exercise-design` owns a complete lesson plan, use this skill as the runtime-ready handoff for every exercise object.
- `k2-lesson-exercise-design`: use when the user supplies or identifies a vocabulary-led language lesson and asks to design or revise its complete Vocora learning path, including prerequisite-aware exercise order, the fixed vocabulary-intake and spelling/dictation opening exercises, evidence-backed rationale, source coverage, and a slide array for every exercise. It owns the canonical lesson-plan JSON design contract, not Angular/runtime implementation. Use `k2-bbc-listening-bundles` instead for BBC bundle packaging or BBC-specific question-authoring work; use a named handoff when both scopes are explicitly requested.

Do not use the BBC bundle skill for normal listening UI implementation, database migrations, generic vocabulary collection editing, or deployment unless the request also asks to prepare episode bundles.

## Skill authoring

When creating or changing a skill:

1. Follow the `Agent skill architecture` section in the root `AGENTS.md`.
2. Apply `k2-principles` first and `k2-skill-architecture` second, then keep the task-specific skill as the execution owner.
3. Keep `SKILL.md` as the initial router/invariant contract.
4. Keep repeatable parsing, planning, validation, and artifact checks script-owned.
5. Keep source interpretation and language/content judgment agent-owned.
6. Add focused deterministic tests with executable skill scripts.
7. For executable JavaScript or TypeScript skill scripts, also apply `k2-skill-script-architecture`.
8. Run focused tests, the skill-owned validator, and the applicable architecture validators before finalizing.

Do not copy another repository's project-specific policy into Vocora. Reuse the structural pattern only and keep Vocora's own contracts authoritative.
