# Vocora Agent Notes

Read the repository root `AGENTS.md` first. It is the repository-wide source of truth.

## Skill routing

Use the smallest applicable existing skill.

- `vocora-bbc-listening-bundles`: use when the user asks to find, prepare, validate, or return one or more BBC 6 Minute English episode ZIP bundles by exact date, inclusive date range, title, or official episode URL. It owns multi-episode discovery orchestration, exact requested test counts/difficulty distribution, episode assets, episode vocabulary, source-reference/full-transcript handling, canonical packaging, and one-ZIP-per-episode delivery.

Do not use the BBC bundle skill for normal listening UI implementation, database migrations, generic vocabulary collection editing, or deployment unless the request also asks to prepare episode bundles.

## Skill authoring

When creating or changing a skill:

1. Follow the `Agent skill architecture` section in the root `AGENTS.md`.
2. Keep `SKILL.md` as the initial router/invariant contract.
3. Keep repeatable parsing, planning, validation, and artifact checks script-owned.
4. Keep source interpretation and language/content judgment agent-owned.
5. Add focused deterministic tests with executable skill scripts.
6. Run the skill-owned validator and focused tests before finalizing.

Do not copy another repository's project-specific policy into Vocora. Reuse the structural pattern only and keep Vocora's own contracts authoritative.
