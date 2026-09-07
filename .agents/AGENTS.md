# Vocora Agent Notes

Read the repository root `AGENTS.md` first. It is the repository-wide source of truth.

## Skill routing

Use the smallest applicable existing skill.

- `k2-principles`: mandatory once at the start of every mutation task before any code, docs, tests, configuration, workflow, architecture, schema, contract, data-model, migration, or agent-skill change. Select only the smallest relevant principle set, read only those references, state why each applies, then return execution to the owning workflow. Read-only investigation, explanation, and review do not require it unless a mutation is requested.
- `vocora-bbc-listening-bundles`: use when the user asks to find, prepare, validate, or return one or more BBC 6 Minute English episode ZIP bundles by exact date, inclusive date range, title, or official episode URL. Also use it to review or redesign existing BBC listening questions and their quality rules; read its IELTS design reference before authoring. It owns multi-episode discovery orchestration, exact requested test counts/difficulty distribution, episode assets, episode vocabulary, source-reference/full-transcript handling, canonical packaging, and one-ZIP-per-episode delivery.

Do not use the BBC bundle skill for normal listening UI implementation, database migrations, generic vocabulary collection editing, or deployment unless the request also asks to prepare episode bundles.

## Skill authoring

When creating or changing a skill:

1. Follow the `Agent skill architecture` section in the root `AGENTS.md`.
2. Apply `k2-principles` first, then keep the task-specific skill as the execution owner.
3. Keep `SKILL.md` as the initial router/invariant contract.
4. Keep repeatable parsing, planning, validation, and artifact checks script-owned.
5. Keep source interpretation and language/content judgment agent-owned.
6. Add focused deterministic tests with executable skill scripts.
7. Run the skill-owned validator and focused tests before finalizing.

Do not copy another repository's project-specific policy into Vocora. Reuse the structural pattern only and keep Vocora's own contracts authoritative.
