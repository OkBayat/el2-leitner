# Vocora Agent Guide

## Repository authority

This file is the repository-wide source of truth for coding agents working in Vocora.
Read it before changing code, data contracts, tests, deployment behavior, or agent skills.
Then read the nearest task-specific documentation or skill referenced from `.agents/AGENTS.md`.

## Mandatory principle selection

Before making any code, docs, config, test, workflow, architecture, schema,
contract, data-model, migration, or agent-skill change, apply `k2-principles`
once at task start.

- `k2-principles` is the sole owner of general Karpathy, TDD, DDD, SOLID,
  CQRS, security, data-integrity, contract, and reliability guidance.
- Specialized domain, execution, review, and validation skills remain workflow
  owners but must not redefine general principles.
- Load only the references selected by `k2-principles`, state why each applies,
  then return execution to the primary workflow.
- Read-only investigation, explanation, and review do not require principle
  selection unless a mutation is requested.

## Language rule

All engineering artifacts must be written in English unless the user explicitly requests a specific data item or user-facing content in another language.

This rule includes:

- source code comments and docstrings;
- identifiers introduced by the change when naming is under agent control;
- README files and developer documentation;
- test names, fixtures, failure messages, and diagnostics;
- shell-script output and usage text;
- database migration comments;
- agent instructions, skills, references, schemas, and examples;
- commit messages, pull-request titles, and pull-request descriptions.

Do not translate existing domain data merely to satisfy this rule. User-authored or source-authored content may remain in its required language when that language is part of the data contract. When a user explicitly asks for content in another language, keep the surrounding engineering documentation in English and localize only the requested data or product copy.

## Source truth and managed content

- Application source truth lives in `back/src/**`, `ui/src/**`, database migrations, and the checked-in configuration files.
- File-managed vocabulary collections live under `back/data/collections/**`; follow `docs/COLLECTION_SOURCES.md`.
- File-managed listening episodes live under `back/data/listening/episodes/**`; follow `back/data/listening/episodes/README.md`.
- Never treat build output, generated artifacts, Docker layers, caches, or temporary files as source truth.
- Never invent remote APIs, BBC asset URLs, episode dates, transcript locations, or metadata. Verify source facts against the official source before persisting them.

## Architecture and change discipline

- Preserve the existing Domain/Application/Infrastructure/Interface separation in the backend.
- Keep HTTP details out of domain and application rules.
- Keep persistence details behind repositories/adapters rather than embedding SQL in domain logic.
- Preserve the existing Angular service/state/component boundaries in the UI.
- Prefer small, cohesive changes over broad rewrites.
- Reuse existing commands and source contracts instead of introducing parallel mechanisms for the same behavior.
- Preserve backward-compatible public IDs, persisted learner progress, completed attempt snapshots, and existing user-facing behavior unless the task explicitly changes them.

## Frontend styling

- Prefer Angular Material components and directives whenever Material provides the standard interactive primitive needed by the UI, including buttons, icon buttons, dialogs/popups, menus, form fields and inputs, selects, checkboxes, radios, tabs, tooltips, snackbars, and progress indicators.
- Do not hand-roll a replacement for an Angular Material primitive unless Material cannot satisfy a concrete functional or product requirement. Domain-specific composite components should compose Material primitives where applicable.
- If an Angular Material component needs a project-wide visual change, define the override centrally so every instance inherits the same styling. Do not reskin Material primitives independently in feature or component-local styles.
- Angular Material system colors must be mapped centrally in `ui/src/styles/_angular-material-theme.scss` to Vocora design-system tokens. Do not introduce raw Material palette colors or component-local color overrides for Material primitives.
- Prefer Bootstrap utility classes whenever they can express layout, spacing, alignment, display, sizing, color, and similar presentational rules (for example `d-flex`, `justify-content-center`, `align-items-center`, `gap-2`, `pt-5`, `w-100`, `bg-primary`, `text-primary`, and `border-success`).
- For semantic colors, prefer Bootstrap color utilities such as `bg-primary`, `text-primary`, `border-primary`, `bg-success`, `text-warning`, and `text-danger` instead of hard-coded colors or component-local color helpers.
- Bootstrap semantic colors must be mapped centrally in `ui/src/styles/_bootstrap-theme.scss` to Vocora design-system tokens. Do not redefine Bootstrap semantic colors in component styles.
- Keep raw palette values in the Vocora design system; Bootstrap and Angular Material theme adapters must reference those tokens rather than own duplicate hex/RGB colors.
- Prefer, in order: Angular Material for standard interactive components, Bootstrap utilities for presentational helpers, existing shared project styles/components, then custom CSS or custom UI primitives.
- Do not add custom CSS when an equivalent Bootstrap utility or centralized Angular Material override already exists; keep frontend styling consistent across the application.

## Testing

Use test-driven development for new deterministic behavior and regression tests for bug fixes.

Before finalizing a change, run the smallest relevant focused tests and then the repository-level checks affected by the change. Do not disable, skip, weaken, or delete unrelated tests to make a change pass.

For listening episode work, validation must include the canonical episode validator and any relevant MySQL/browser integration coverage. For agent-skill changes, run the skill-owned validator and focused skill tests.

## Dependency and command safety

- Prefer `npm ci` for reproducible dependency installation.
- Do not run `npm install` only to change lockfiles unless the task actually changes dependencies.
- Do not run destructive database, Docker volume, Git cleanup, or production deployment commands unless the active request explicitly requires them.
- Do not run `git reset --hard`, broad `git clean`, or commands that can delete ignored media/data.
- Do not overwrite local ignored listening audio automatically.

## Git and pull-request safety

- Keep one coherent user-requested change in one pull request unless the user asks to combine work.
- When a new task depends on an unmerged pull request, use a stacked branch/PR rather than duplicating the dependency.
- Stage and commit only files owned by the active task.
- Do not merge or deploy automatically unless the user explicitly requests it.
- Generated episode ZIP files and episode MP3 files are delivery/runtime artifacts, not repository source. Never commit them.

## Listening episode invariants

- One episode folder represents one stable episode identity.
- Episode language level is one of `elementary`, `intermediate`, or `advanced`.
- Test difficulty is independent from episode language level and follows the application contract.
- Every published episode must contain at least one IELTS-style listening test.
- `transcript.md` remains file-only and is never synchronized into the database.
- Episode vocabulary follows the collection vocabulary contract: vocabulary identity, definition, and natural example are required by the listening authoring workflow.
- Use `back/scripts/manage-listening-episode.py` for canonical episode bundle validation, packaging, verification, and installation.
- Use `scripts/install-listening-episode.sh` for the operator-friendly root-level ZIP installation flow.

## Agent skill architecture

Agent skills live under `.agents/skills/<skill-name>/` and follow the K2-style layout used by this project:

```text
.agents/skills/<skill-name>/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/        # only when detailed phase-specific guidance is needed
└── scripts/           # deterministic operations and focused tests
```

Rules for agent skills:

- `SKILL.md` is the only mandatory skill-local initial instruction file.
- Keep routing, invariants, workflow phases, stop conditions, and the Determinism Boundary in `SKILL.md`.
- Put detailed material in references and load it only when the active phase needs it.
- Prefer deterministic scripts for stable parsing, validation, planning, and artifact verification.
- Keep language/content judgment, source interpretation, and other genuinely semantic work agent-owned.
- A repeatable script-owned operation must not have a prose-only manual fallback. Fix the script or stop with an explicit blocker.
- Keep scripts standard-library-only when practical and test deterministic behavior in the same skill.
- New skills must define `Script-owned`, `Agent-owned`, and `No manual fallback` sections.
- Run the skill-owned validator and tests before finalizing.

## Skill routing

Read `.agents/AGENTS.md` for the smallest applicable skill. When a skill owns the requested workflow, follow that skill instead of recreating its process from memory or from an older conversation.
