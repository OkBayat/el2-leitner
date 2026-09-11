# Vocora Agent Guide

## Repository authority

This file is the repository-wide source of truth for coding agents working in Vocora.
Read it before changing code, data contracts, tests, deployment behavior, or agent skills.
Then read the nearest task-specific documentation or skill referenced from `.agents/AGENTS.md`.

## Enterprise architecture playbook

Read [ARCHITECTURE_PLAYBOOK.md](ARCHITECTURE_PLAYBOOK.md) before planning or
implementing architecture, migration, refactoring, security, delivery, or mobile
packaging changes. It records the source-audited baseline, intended modular
monolith, phased work packages, data-preservation gates, and rollback boundaries.
Distinguish planned architecture from implemented behavior and identify the
relevant work package and affected contracts in the implementation PR.
The playbook does not authorize executing unrelated phases, changing repository
protection, merging, deploying, deleting data, or updating OKF. Existing safety,
E2E restrictions, source-truth rules, and canonical skill workflows remain in
force. Apply the dev-based branch policy only after its explicit bootstrap.

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

## Project knowledge

- Curated durable project knowledge lives in the root `okf/` Open Knowledge Format bundle.
- Read `okf/index.md` before broad project exploration when prior project context may help.
- Repository source and explicit project documentation remain authoritative; when OKF disagrees with current source, verify the source and correct OKF.
- Use `k2-okf-update` only when the user explicitly asks to add, refresh, or review OKF knowledge.
- Run `python3 .agents/skills/k2-okf-update/scripts/validate_okf.py` before finalizing any OKF content change.

## Architecture and change discipline

- Preserve the existing Domain/Application/Infrastructure/Interface separation in the backend.
- Keep HTTP details out of domain and application rules.
- Keep persistence details behind repositories/adapters rather than embedding SQL in domain logic.
- Preserve the existing Angular service/state/component boundaries in the UI.
- Prefer small, cohesive changes over broad rewrites.
- Reuse existing commands and source contracts instead of introducing parallel mechanisms for the same behavior.
- Preserve backward-compatible public IDs, persisted learner progress, completed attempt snapshots, and existing user-facing behavior unless the task explicitly changes them.

## Reusable slide constraint

- Never create a feature-specific slide type, slide component, renderer, or parallel slide interaction.
- Before implementing a slide-based experience, inspect the existing registered slide types and use an existing slide only when its interaction and evidence semantics fully match the requested behavior.
- Do not force a scored slide such as `choice` into a non-scored selection flow, invent a correct answer, or weaken an existing slide contract to make it appear compatible.
- If no existing slide fully supports the requested interaction, stop and tell the user which interaction is unsupported. Add a new slide only when the user explicitly authorizes a general reusable interaction; implement its object-driven contract, registry entry, tests, documentation, and design-system-compatible states together.

## Frontend styling

- Apply `k2-design-system` before product-facing UI work. Its detailed design reference is the canonical contract; use this concise order: existing Vocora shared primitive, Angular Material standard interactive component, Angular CDK behavior, a reusable Vocora primitive under `ui/src/app/shared`, an exact Bootstrap presentation utility, an existing shared style/token, then minimal custom code.
- Keep the standalone Angular architecture. Do not create a giant `SharedModule`, clone reusable primitives inside features, assemble a lower-level CDK replacement when Material already provides the component, or hand-roll framework interaction/accessibility behavior.
- Bootstrap is the utility/layout layer, not the interactive component library. Prefer its exact display, flex, grid, alignment, spacing, sizing, text, border, and semantic-color utilities; do not introduce Bootstrap JavaScript widgets in place of Angular/Vocora components.
- When touching a component/template/style, safely replace nearby legacy CSS with exact Bootstrap utilities and remove the unused declarations. Keep this owner-local; do not force approximate utilities or unrelated repository-wide churn.
- Vocora semantic tokens own product colors. The central Angular Material and Bootstrap adapters map their frameworks to those tokens; feature styles consume the mappings and must not define alternative palettes or framework semantic variables.
- Material product customization uses the supported theming/token API first, then the single central integration layer. Feature SCSS must not redesign undocumented `.mat-mdc-*` internals.
- Custom CSS is last and needs a concrete reason. Do not escalate specificity or add application-owned `!important`; a genuinely unavoidable upstream exception belongs at a documented central integration boundary.

## Testing

Use test-driven development for new deterministic behavior and regression tests for bug fixes.

Use this testing pyramid:

1. Unit tests for pure functions, isolated services, and deterministic adapters.
2. Behavior tests for domain and application rules observed through public behavior.
3. Contract tests for HTTP APIs, persistence ports, provider adapters, schemas, and other boundaries.
4. Regression tests at the lowest level that reproduces a previously discovered bug.
5. Agent evaluation or regression tests for agent decisions, actions, and deterministic skill tooling.

E2E tests are disabled repository-wide. Never create, develop, invoke, or run E2E or Playwright tests, locally or in CI. The current browser tests can leave durable fingerprints and test state in a non-dedicated database. They may be reconsidered only after a dedicated, isolated test database exists and this repository rule and its fail-closed execution guards are explicitly revised. Until then, prove behavior with unit, behavior, contract, regression, or agent-evaluation tests.

Before finalizing a change, run the smallest relevant focused tests and then the repository-level checks affected by the change. Do not disable, skip, weaken, or delete unrelated tests to make a change pass.

For listening episode work, validation must include the canonical episode validator, relevant MySQL integration coverage, and focused component/API tests. For agent-skill changes, run the skill-owned validator and focused skill tests.

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

Before creating, changing, moving, or deleting a skill or shared skill asset,
apply `k2-skill-architecture` after the task-start `k2-principles`
selection. When executable JavaScript or TypeScript under a skill's
`scripts/**` changes, also apply `k2-skill-script-architecture`, record the
pre-edit metrics when the file already exists, and run both architecture
validators before finalizing.

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
- Run `k2-skill-architecture` validation for every skill change and
  `k2-skill-script-architecture` validation for executable JavaScript or
  TypeScript skill-script changes.

## Skill routing

Read `.agents/AGENTS.md` for the smallest applicable skill. When a skill owns the requested workflow, follow that skill instead of recreating its process from memory or from an older conversation.
