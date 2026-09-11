# Vocora Enterprise Architecture and Migration Playbook

> Status: **proposed implementation contract; documentation only**. Merging this document approves a direction, not a production cutover. No migration, deployment, branch protection, dependency installation, or application refactor is performed by this document.
>
> Audit date: **2026-09-10**. Repository: `OkBayat/vocora`.
> Primary source audit and branch comparisons: `3ec8c87ffc6c6325441cabf32aaa84992dfca06a`.
> Documentation branch starts directly from refreshed `main`: `3908ae64c9b5969f475df48ea6a536f68bb18ae5`.
> The intervening two commits affect eight UI builder/rendering/test files, not the audited backend, migrations, packages, deployment configuration, or agent guide. See [audit evidence](#18-audit-evidence-and-limitations).

## Contents

1. [Direction and authority](#1-direction-and-authority)
2. [What exists and what needs attention](#2-what-exists-and-what-needs-attention)
3. [Target system and domain ownership](#3-target-system-and-domain-ownership)
4. [Repository layout and shared contracts](#4-repository-layout-and-shared-contracts)
5. [TypeScript, constants, and frontend refactoring](#5-typescript-constants-and-frontend-refactoring)
6. [NestJS backend migration](#6-nestjs-backend-migration)
7. [PostgreSQL migration and data preservation](#7-postgresql-migration-and-data-preservation)
8. [Managed content and media](#8-managed-content-and-media)
9. [Security and persistent authentication](#9-security-and-persistent-authentication)
10. [Branching and automatic delivery](#10-branching-and-automatic-delivery)
11. [Tests and architecture enforcement](#11-tests-and-architecture-enforcement)
12. [Operations, recovery, and performance](#12-operations-recovery-and-performance)
13. [Capacitor and store distribution](#13-capacitor-and-store-distribution)
14. [Four-week implementation sequence](#14-four-week-implementation-sequence)
15. [Executable work packages](#15-executable-work-packages)
16. [Agent operating contract and completion gates](#16-agent-operating-contract-and-completion-gates)
17. [Branch inventory and development history](#17-branch-inventory-and-development-history)
18. [Audit evidence and limitations](#18-audit-evidence-and-limitations)
19. [External references](#19-external-references)

## 1. Direction and authority

### 1.1 The selected direction

Build a **TypeScript modular monolith with NestJS and PostgreSQL**, retaining the existing Angular application in the same repository. Use Capacitor to package the frontend for Android and iOS after the application contracts are stable.

A monorepo describes source ownership; a modular monolith describes backend deployment and module boundaries. Neither requires placing the database, browser application, and speech engine in one process.

| Decision | Target | Explicitly not selected now |
| --- | --- | --- |
| Backend | NestJS, feature modules, one application deployable | Microservices; a rewrite of all domain behavior |
| Database | PostgreSQL; relational learning state and appropriate JSONB content | MongoDB; two permanent authoritative databases |
| Frontend | Existing Angular, Angular Material, Bootstrap CSS utilities | Another frontend rewrite; Ionic component replacement |
| Repository | Keep `back/`, `ui/`, `speech/`; introduce a small shared workspace | Separate repositories; a cosmetic mass directory move |
| Temporary state | Existing bounded mechanisms; PostgreSQL-backed authentication records where needed | Redis |
| Operations | Structured logs, health/readiness, backup verification, basic alerts | Prometheus/Grafana deployment in this migration |
| Mobile | Capacitor native projects using built Angular assets | Compiling Angular components into Java/Swift widgets |
| Delivery | Feature -> `dev` -> `main`; automatic staging/production deployment | Feature -> `main` after bootstrap; direct protected-branch pushes |
| Data access | Initially explicit parameterized SQL through existing repository ports | Mandatory simultaneous Prisma/TypeORM conversion |

PostgreSQL is an architectural choice here, **not a claim that it is universally faster than MySQL**. Performance acceptance is based on Vocora workloads in section 12.

### 1.2 Authority and scope

`AGENTS.md` remains the repository-wide agent authority. `k2-principles` remains the sole owner of general engineering principles; this playbook applies them to Vocora rather than defining another generic principles framework. Task delivery, review, validation, and domain skills retain their responsibilities.

When this playbook and existing source differ, distinguish **intended target** from **implemented behavior**. Preserve source contracts until an explicitly scoped, tested migration changes them. Resolve contradictory documentation in the owning implementation PR; do not silently override data invariants.

The principal concerns selected for this work are surgical change and scope control, dependency boundaries, security, data integrity, explicit contracts, and recoverability. Existing OKF domain knowledge was consulted. This task does **not** authorize changing OKF or its skills.

The current absolute E2E/Playwright prohibition remains in force. Historical references to three smoke tests are superseded by current `AGENTS.md` and its execution guards.

### 1.3 Delivery rules

- Refactor a vertical slice, prove equivalence, release it, and remove its superseded owner. Do not leave two implementations that can both write the same fact.
- Separate database-engine migration, framework migration, and intentional product/security behavior changes. Do not hide all three in a rename-heavy PR.
- Preserve vocabulary identities, public routes, learner history, completed attempt snapshots, content provenance, and explicit unsubscribe/enrollment state.
- No promise of an unhackable application, automatic store approval, or a guaranteed one-month cutover is made.
- The four-week plan is a planning envelope with stop gates. Failed gates move dates, not safety requirements.

## 2. What exists and what needs attention

### 2.1 Source-backed baseline

The project is not starting from a blank or entirely unstructured codebase.

| Surface | Observed implementation | Consequence for this migration |
| --- | --- | --- |
| Backend | Express 5, JavaScript ESM, `mysql2`, injected repositories in `back/src/container.js` | Reuse application operations and port boundaries; migrate adapters incrementally |
| Backend structure | Domain/Application/Infrastructure/HTTP layers plus `modules/collection-learning-path` | Consolidate existing boundaries into Nest modules, not a generic service framework |
| Frontend | Angular 22.1.x, Angular Material 22.1.4, TypeScript ~6.0.2, standalone components | Refactor remaining debt; do not repeat the completed Angular migration |
| UI debt | Login component contains inline HTML, inline compressed styles, dense methods, and direct copy strings | External templates/styles and named copy are concrete work, not hypothetical cleanup |
| UI guards | Architecture tests inspect source text, including literal routes and HTML inside auth `.ts` files | Update the owning assertions when moving templates/constants; retain their semantic protection |
| Persistence | Normalized catalog, sparse learner progress, review events, sessions, daily stats, learning-path progress | Do not replace this with one JSON document per user |
| SQL history | 23 numbered MySQL migrations, `001` through `023` | Preserve the immutable historical ledger; create a separate PostgreSQL migration lineage |
| Content | File-managed Markdown collections and JSON-driven learning definitions | Files remain managed content inputs; learner state remains database-owned |
| Authentication | JWT cookie; Compose defaults indicate seven-day token/cookie lifetime | Persistent login currently is not an immortal session |
| Logout | HTTP handler clears the cookie | Implement server-side revocation; clearing a browser cookie alone does not revoke a copied credential |
| Review writes | Server validates submitted word/event/daily fields and writes many supplied counters and outcomes | Add server-authoritative assessment and state transitions in a dedicated security work package |
| Runtime | One UI/API container, private MySQL, Vosk speech service, private Kokoro TTS service | Preserve private provider boundaries and acknowledge process-local state limitations |
| Deployment | `scripts/deploy.sh` builds on the server and runs database setup before app recreation | Move to tested immutable artifacts, readiness checks, and a documented recovery path |
| CI | Eleven workflows, including HTTP/database integration suites; no staging/production deployment workflow observed | Add deployment workflows intentionally; retain regression value without restoring E2E |
| Repository policy | No `dev` branch, branches reported unprotected, rulesets endpoint returned an empty list | Bootstrap the desired merge and deployment policy explicitly |

Primary evidence: [backend package][r-back-package], [UI package][r-ui-package], [composition root][r-container], [app construction][r-app], [login component][r-login], [architecture tests][r-ui-tests], [Compose][r-compose], [deployment script][r-deploy], [test workflow][r-ci].

### 2.2 Risks to prioritize, not just rename

**Configuration exposure:** Compose publishes phpMyAdmin on `0.0.0.0` by default and defaults `COOKIE_SECURE` to `false`. These are source configuration findings, not proof of an exposed production installation. Verify effective environment values, reverse-proxy configuration, TLS, firewall policy, and externally reachable ports. Production must not rely on development defaults.

**Learning trust boundary:** `RecordReviewResult` accepts client-supplied outcome/progress fields, while `MySqlReviewProgressRepository` stores supplied absolute counters after ownership/revision checks. This supports an authenticated learner's ability to influence their own learning record beyond raw-answer submission. It is not evidence of account takeover or SQL injection. Stronger schema validation alone does not fix this trust boundary. See [the command][r-review-command] and [repository][r-review-repository].

**Compatibility write path:** `PUT /api/state`, import/restore, settings, and reset paths must be included in the authority review. Hardening the compact review endpoint while leaving a writable bypass is insufficient.

**Public identity:** Migration 020 creates generated, append-only route-ID mappings and immutable resource-parent relationships. A table copy that omits these guarantees is a regression. See [migration 020][r-route-ids].

**Test-to-implementation coupling:** Existing source-string checks can fail after a legitimate constant or template extraction. Replace only the affected textual assumptions with equivalent AST/compiled-contract/component assertions; do not disable the architecture check.

**Operational recovery:** `/api/health` currently responds with a static healthy status. It must not be treated as evidence that PostgreSQL is reachable or the expected schema/content version is active. Existing deploy behavior lacks a verified post-deploy application-readiness/rollback sequence in the inspected script.

### 2.3 Measurements still required

Before setting capacity or cutover promises, collect the deployed commit, actual database version/schema ledger, data volumes, largest rows, request and query latency distributions, concurrent sessions, storage usage, backup age/restore duration, and current infrastructure limits. None of these production measurements were obtained in this documentation audit.

Create an exact inventory of remaining application JavaScript, inline Angular templates/styles, duplicate business owners, route definitions, SQL objects, and architecture exceptions. Do not invent a repository-wide duplication percentage or claim every source line has been reviewed.

## 3. Target system and domain ownership

### 3.1 Deployment model

```text
Browser / installed PWA                 Android / iOS Capacitor
         |                              Angular assets + native plugins
         +---------------- HTTPS ---------------------+
                                  |
                     Trusted reverse proxy / TLS
                                  |
                  Vocora NestJS modular monolith
                  - serves the web Angular build
                  - owns REST authorization and commands
                  - owns composition and lifecycle
                     |             |             |
                 PostgreSQL    Vosk service   Kokoro service
                 private       private        private
                     |                            |
            durable user state              bounded filesystem
            content projections             TTS cache

Managed MD/JSON + media manifest -> validated one-shot publisher/migrator
                                      -> database content projections
```

The monolith is the owner of product application rules. Existing speech providers are infrastructure dependencies, not permission to split every domain into a microservice. There is no Redis, broker, Kubernetes, or distributed command bus requirement.

Start with one backend instance. Horizontal replication is blocked until the team resolves process-local shadowing session ownership, TTS single-flight/cache coordination, and distributed rate-limit behavior. A PostgreSQL connection pool alone does not solve those constraints.

### 3.2 Domain boundaries

| Domain/module | Owns | Must not own |
| --- | --- | --- |
| Identity and access | Accounts, credentials, sessions, roles, recovery and revocation | Vocabulary correctness or course completion |
| Library/catalog | Collection membership, vocabulary identities/forms, provenance, source metadata | A separate copy of every learner's word |
| Learning-path delivery | Ordered lessons/exercises, prerequisites, enrollment, immutable attempt scope, completion evidence | A second Leitner scheduler or listening grader |
| Retention/Leitner | Item activation, spelling-recall assessment, scheduling, mastery, review events | Global course completion or guaranteed proficiency |
| Listening | Published tests, private answer keys, owned attempts, grading, immutable result snapshots | Duplicated tests embedded in arbitrary slide JSON |
| Speaking/shadowing | Audio assessment, appropriate recording evidence, provider adapters | Client-declared success as authoritative assessment |
| Progress/reporting | Read projections, daily timeline and learner-facing summaries | Independent writes that redefine primary learning facts |
| Media/TTS | Safe asset access, provider calls, bounded cache and recording lifecycle | Public access to private audio/answers or arbitrary URL fetching |
| Gamification, when implemented | Idempotent projections from qualifying learning facts | Redefining learning correctness to award XP |
| Social, when implemented | Relationships and explicitly public projections | Access to private learning attempts or auth state |

Preserve the currently implemented collection/path relationship. Do not introduce a new `Course` aggregate with invented cardinality merely because the UI says course. The long-term Course-to-LearningPath cardinality, XP formulas, reward economy, and social product rules remain explicit product decisions, not assumptions in a framework migration.

The [existing domain record][r-domains] also acknowledges a spelling-evidence gap in self-report quick-review/mastery flows. Close this through an approved behavior change and regression tests. Do not silently treat `Remembered` as equivalent to dictation evidence.

### 3.3 Cross-module communication

Use explicit application interfaces and injected ports. A module must not reach into another module's repository to modify its records. Cross-module writes that must be atomic use one deliberately scoped database transaction through application orchestration.

Read projections may join relevant relational data through an owned query adapter. Do not require network calls or duplicate databases to make modules appear independent.

Simple synchronous application calls are the default. Add a transactional outbox only when a real asynchronously delivered fact requires durable delivery; do not add an event framework merely for naming. Any derived XP or streak effect must be deduplicated against its originating event before it becomes authoritative.

## 4. Repository layout and shared contracts

### 4.1 Proposed layout

Retain existing high-value paths and move ownership only when needed. Items marked `new` below are targets, not files already created by this PR.

```text
/
  AGENTS.md
  ARCHITECTURE_PLAYBOOK.md
  package.json                         # new: workspace orchestration
  package-lock.json                    # new: one workspace lockfile after a dedicated transition
  tsconfig.base.json                   # new: common strict options, app-specific overrides
  back/
    src/
      main.ts                          # new: Nest bootstrap
      app.module.ts
      config/                          # validated server configuration
      shared/                          # backend-only operational constants/utilities
      modules/
        auth/
        library/
        collection-learning-path/      # preserve current bounded context
        learning/
        listening-practice/
        shadowing-practice/
        text-to-speech/
        reporting/
    database/
      migrations/                      # immutable existing MySQL history during transition
      postgres/migrations/             # new PostgreSQL lineage
    data/                              # existing managed sources remain authoritative
    scripts/
    tests/
    Dockerfile
  ui/
    src/app/
      app.routes.ts
      core/                            # infrastructure and app-wide services
      application/                     # existing orchestration owners
      domain/                          # existing pure learning models
      features/
      shared/
        constants/                     # UI-wide, non-domain-specific constants only
        slide-exercise/                # existing single reusable interaction library
    src/styles/                        # central design tokens and theme adapters
    capacitor.config.ts                # new, only in mobile work package
    android/                           # new native source project, not generated build output
    ios/                               # new native source project
  packages/
    contracts/src/                     # new, deliberately browser-safe
      api/
      identifiers/
      errors/
      constants/
      index.ts
  speech/                              # existing Python provider; not converted to TypeScript
  scripts/                             # deployment and operational entry points
  docs/
  okf/                                 # changes remain explicit-request-only
  .agents/
  .github/workflows/
```

Inside a nontrivial backend module use `domain/`, `application/`, `infrastructure/`, and `http/` with a narrow module entry point. Do not generate four empty layers for trivial code. During migration, existing top-level domain/application files can remain their single owner until their vertical slice moves.

### 4.2 Shared means one source, not unrestricted access

`@vocora/contracts` is a proposed private workspace package for public wire types, validated public identifiers, interoperable error codes, and deliberately shared protocol constants. It must not depend on Angular, NestJS, the database driver, or Node-only runtime APIs.

Never export server configuration, environment secrets, password/session structures, SQL models, grading answer keys, private content, or repository implementations to this package. DTO classes containing Nest decorators are not automatically shared frontend models. Public schemas must remain separate from internal persistence entities.

UI copy belongs to UI constants/copy catalogs; server diagnostic text belongs to backend constants. A string is shared because its **meaning and contract** are shared, not because its characters happen to match.

Initially retain the two existing lockfiles while establishing compatibility. Consolidate to a single npm workspace lockfile in one dedicated build-tool PR, updating Docker build context, cache keys, CI, scripts, and documentation together. Do not leave two active dependency-resolution authorities. Prove both applications build from a clean checkout before deleting old lockfiles.

Pin and validate a mutually supported Node/Angular/TypeScript/Nest toolchain in that PR. The current CI Node pin is `22.23.2`; the backend's looser engine declaration alone is not the workspace compatibility contract. Consult [Angular compatibility][x-angular] and validate the actual locked packages rather than blindly selecting latest versions.

### 4.3 Dependency gates

Enforce an import graph: domain -> pure shared types only; application -> domain and ports; infrastructure -> ports and external libraries; HTTP -> application and transport models. Module entry points export the smallest useful surface. UI features may use UI shared code, but shared code must not import a feature.

Use targeted exports instead of a giant barrel that drags every constant and module into every bundle. No cyclic dependencies, runtime service locator, or repeated `forwardRef` workaround should be accepted as the default design.

## 5. TypeScript, constants, and frontend refactoring

### 5.1 Application code policy

New owned frontend and backend application code must be TypeScript. Enable strict type checking, precise public return types, `unknown` at untrusted boundaries, and exhaustive discriminated unions where state variants are finite. Do not replace missing types with `any`, broad assertions, `@ts-ignore`, or catch-all dictionaries.

Existing backend JavaScript is migrated slice by slice behind a documented transition boundary. No new domain behavior should be added to a legacy JavaScript owner when that slice is being converted. Keep the legacy file only until its replacement is exercised; do not keep `.js` and `.ts` business implementations side by side indefinitely.

Python speech/content tooling, shell scripts, SQL migrations, JSON/Markdown content, generated JavaScript bundles, and native Swift/Kotlin/Java plugin code are not TypeScript application-code violations. Existing `.mjs` architecture/build tools may remain as explicitly cataloged tooling exceptions; they are not a license to add application behavior in JavaScript.

### 5.2 External Angular files

Every new or migrated production Angular component has separate files:

```text
feature-name.component.ts
feature-name.component.html
feature-name.component.scss
feature-name.component.spec.ts
```

Use `templateUrl` and `styleUrl`/`styleUrls`. Inline templates/styles in production components are forbidden by Vocora's selected convention, even though a framework may technically support them. A tiny test-only host component may use an inline fixture when explicitly classified as a test fixture.

Start with `features/auth/login-page.component.ts`, then registration and the remaining measured inventory. The login source is a confirmed example containing both inline HTML and styles. Extract without changing auth behavior, focus order, responsive layout, or validation messages.

Expand compressed multi-statement methods into readable methods with one responsibility. Keep existing standalone, OnPush, signal, and service boundaries. Do not add NgRx, another state store, or Angular NgModules solely to label the design enterprise.

Use a single command path for click/Enter submission, preserve number-key selection, ignore inappropriate shortcuts while an input/IME composition owns them, and cancel stale audio/network callbacks when an exercise changes. Do not restore the legacy DOM-driven coordination removed during the Angular migration.

### 5.3 Strict constants and copy policy

**All application-owned runtime string values must have a named owner, even when used once.** This includes page labels such as `Home`, error codes, route segments, storage/header keys, event names, feature identifiers, UI messages, and domain states. Runtime consumers use exported constants, typed builders, or copy catalog entries instead of spelling values inline.

Use scoped files such as `auth-copy.constants.ts`, `learning-path-routes.constants.ts`, and `review-status.constants.ts`. UI-wide values may live in `ui/src/app/shared/constants`; backend-wide operational values may live in `back/src/shared/constants`; truly public cross-application values belong in `packages/contracts`.

Illustrative target, not a new existing API:

```typescript
// ui/src/app/shared/constants/navigation.constants.ts
export const NAVIGATION_COPY = {
  home: 'Home',
} as const;

// ui/src/app/shared/constants/page-paths.constants.ts
export const PAGE_PATHS = {
  home: 'home',
} as const;
```

The component exposes the catalog with a readonly field; HTML binds to `copy.home`; route configuration consumes `PAGE_PATHS.home`. Route builders accept validated identifiers and encode path/query values. Do not change existing route text just to match this example.

Keep domain constants distinct from presentation labels. Reuse does not mean that unrelated concepts named `active`, `complete`, or `Home` must share one global constant.

**Finite syntax/data exceptions:** module import specifiers; framework file references/selectors; static HTML/CSS syntax and utility classes; SQL/schema source text; regular-expression syntax; serialized authored content; generated artifacts; and deliberate test or fixture oracles are not blanket-extracted into a global strings file. Application-specific attribute values, ARIA copy, messages, and route expressions are not excused merely because they appear in HTML. Parameterized SQL belongs in an owned repository/query file and must never become a cross-application constant.

Inventory exceptions by category and exact owning path. An exception must not contain a hidden business decision. New exceptions require a reason, reviewer, and removal/retention decision. Do not generate opaque constants such as `STRING_001` or extract every punctuation mark. Use semantic names and keep consumers readable.

Implement a TypeScript/Angular-template AST-based rule, not a raw quote-count regex. Begin with zero new violations and a shrinking baseline for existing files; convert the entire owned application inventory before marking the refactor complete. Independent contract fixtures may intentionally repeat a wire literal so producer and consumer cannot drift together undetected.

### 5.4 Visual and component ownership

Angular Material remains the standard interactive component owner; Bootstrap remains CSS utilities only. Preserve central color mappings in `_angular-material-theme.scss` and `_bootstrap-theme.scss`. Do not introduce component-local palettes or load Bootstrap JavaScript.

Retain the approved mobile-first, minimal interface. Structural refactoring is not authorization to redesign learning screens, cards, navigation, mascot assets, or course semantics.

Maintain one reusable slide registry and renderer. Course/lesson data selects existing interactions; it does not create feature-specific slide components. If a genuinely unsupported interaction is needed, follow the explicit-authorization rule in `AGENTS.md`. Non-scored selection must not be disguised as a graded question.

### 5.5 Routing and client state

Preserve existing public URLs and deep links initially, including numeric learning-path route IDs represented as decimal strings. Do not convert identifiers to JavaScript `number` or substitute titles/slugs for stable IDs.

Keep route definitions centralized with typed route builders, lazy feature loading, and one owner per route. Preserve guard/return-to behavior and reject unsafe redirect targets. Client guards are presentation/access convenience; every backend resource still requires server authorization.

Keep account session, learning attempt, and practice-session concepts separate. Do not use one generic `session` store for all three. Mark an answer saved only after the correct server revision/result is acknowledged. Persisted domain truth must not be inferred from local navigation or visible DOM.

## 6. NestJS backend migration

### 6.1 Reuse the existing seams

The composition root already injects user, library, learning state, review, vocabulary activation, listening, and practice repositories. Keep those contracts while replacing infrastructure. The initial PostgreSQL application can still run under Express.

NestJS initially uses its Express platform adapter to minimize HTTP behavior changes. Removing legacy Express route/composition ownership does **not** require removing Express as Nest's underlying HTTP adapter. Do not combine a Fastify conversion with this migration.

Use explicit provider tokens for application ports; TypeScript interfaces do not exist as runtime DI tokens. Keep domain/application rules free of Nest decorators and HTTP exceptions. Modules compose providers and intentionally export application operations. [Nest modules][x-nest] provide the runtime composition mechanism, not the business architecture by themselves.

### 6.2 Route migration order

1. Bootstrap/configuration, exception mapping, request correlation, liveness/readiness, and shutdown.
2. Read-only library/progress endpoints with existing response contracts.
3. Authentication adapter with unchanged behavior first; session redesign is its own work package.
4. Compact activation/settings/review commands and practice lifecycle, preserving transaction boundaries.
5. Learning-path start/resume/complete, content projections, recording evidence, and conflict semantics.
6. Listening/audio/TTS/shadowing adapters, streaming/range/error behavior, and provider failure handling.
7. Remove old route owners and bootstrap paths once the corresponding contract matrix passes.

Temporary legacy mounts must have an exact route ownership table, tests against duplicate registration, a removal work package, and a single transaction/pool authority. Do not run old and new writers independently on the same request.

### 6.3 HTTP contract requirements

Controllers parse transport, authorize the request, call an application operation, and map its result. They must not contain SQL, grading, scheduling, or duplicate business validation.

Introduce DTO validation with explicit accepted properties, bounded lengths and collection sizes, and intentional coercion. Reject unknown security-sensitive properties. Avoid permissive conversion of string booleans such as `"false"` into true. Public identifiers remain validated strings.

Preserve the current `/api` route surface, status codes, canonical `{ error: { code, message } }` envelope, cookies, ownership checks, optimistic `409` conflicts, media range behavior, cache rules, and CSP. Do not silently replace these with default Nest error bodies or a universal `{ data: ... }` wrapper. New API versions require a separately documented compatibility plan.

Build an API inventory with method, path, DTO/schema, auth/role policy, ownership predicate, response/error contract, idempotency behavior, transaction owner, and legacy/new handler. Use it as a migration checklist and contract-test matrix.

### 6.4 Runtime and transaction boundaries

Use one managed database pool with connection, query, and acquisition limits. A transaction stays on the same acquired connection, releases in `finally`, and does not make slow external speech calls while holding database locks.

Validate environment configuration at startup; fail closed for missing production secrets or unsafe settings. Do not use TypeScript constants as a place to hard-code environment credentials.

On shutdown, stop accepting traffic, let bounded in-flight operations finish, stop creating provider work, close streams/pools, and record interrupted attempts without falsely marking them complete. Existing process-local speech sessions require an explicit restart policy.

After TypeScript compilation, test production paths for static Angular assets, migrations, managed content, and provider resources. Moving `src/server.js` to compiled output changes relative path assumptions; a passing development run is not sufficient proof.

## 7. PostgreSQL migration and data preservation

### 7.1 Engine and persistence choice

Use a supported PostgreSQL release selected and pinned in the implementation PR. Keep parameterized SQL adapters, initially using `pg`, behind the existing ports. This minimizes simultaneous changes because the project currently does not use an ORM.

Use relational tables for identity, ownership, memberships, progress, events, revisions, attempts, and enrollment. Use JSONB for bounded, schema-validated variable content such as exercise configuration or immutable result detail, not an unbounded whole-account write model.

JSONB changes object representation: raw whitespace/key order and duplicate-key behavior are not preserved, and some inputs valid in other JSON implementations are rejected. Preserve source-file hashes separately and use explicit canonicalization for semantic comparison. Do not expect an unchanged raw JSON checksum after conversion. [PostgreSQL JSON documentation][x-json] is the reference for these constraints.

### 7.2 Preserve all existing migration intent

Keep the existing 23 MySQL migrations immutable. Do not translate them in place after they have been recorded by checksum. Introduce `back/database/postgres/migrations/` with its own schema ledger, version namespace, checksums, and baseline provenance.

The implementation inventory must map every table, index, constraint, trigger, default, foreign key, and repair/import operation from the current MySQL lineage to its PostgreSQL owner. `schema.sql` alone is not the full production schema.

Migration groups to cover:

- `001-004`: legacy archive, normalized catalog/learning, user overrides.
- `005-010`: sentence and listening catalog/test/audio changes.
- `011-015`: managed definitions, provenance, normalized forms, episode sources, content cleanup.
- `016-017`: practice local days and daily listening goal.
- `018-019`: learning-path content/progress and optimistic revision.
- `020-023`: stable public route mappings, recording artifacts, light theme default, independent enrollment state.

The PostgreSQL baseline represents the final intended schema plus equivalent invariants; it does not need to replay every historical MySQL-specific repair against new empty tables. Existing production data still requires a provenance-preserving import.

### 7.3 Conversion risk matrix

| Risk | Required treatment and verification |
| --- | --- |
| `BIGINT UNSIGNED` | Measure maxima. PostgreSQL signed bigint does not cover the entire unsigned range. Use a justified `numeric(20,0)` mapping where necessary; never truncate. Keep HTTP IDs as strings |
| Auto-increment/route mappings | Import exact IDs, parent bindings, and public mappings before enabling target allocation; reset sequences safely after load; ensure new allocations cannot collide |
| Generated-only/append-only triggers | Migration 020 protections must be recreated with PostgreSQL-compatible constraints/triggers/privileges. Only the controlled import role may load preserved identities |
| Collation and normalization | Preserve vocabulary identity semantics, including migration 013's binary normalized-form behavior; test accents, Unicode normalization, apostrophes, aliases, and case rules separately from display sorting |
| Timestamps and learner days | Map instants to an intentional UTC-aware representation; preserve millisecond precision. Keep learner local-day values as dates under their original timezone semantics, not recomputed server-local dates |
| Boolean conversion | Map zero/one, null, JSON booleans, and string booleans explicitly; do not rely on language truthiness |
| JSON/JSONB | Distinguish SQL NULL from JSON null; detect duplicate keys, unsupported characters/numbers, and schema drift before load; compare canonical semantics while preserving raw source hashes |
| Binary/recording artifacts | Preserve payload bytes, ownership, MIME metadata, size, checksum, attempt references, and access controls; do not classify durable evidence as disposable cache |
| SQL dialect | Rewrite placeholders, backticks, `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, generated IDs, date functions, and affected-row assumptions explicitly |
| Isolation and locking | Test optimistic revision checks, lock ordering, concurrent first-row creation, retry/deadlock handling, and idempotency under the actual PostgreSQL isolation level |
| Query semantics | Verify null ordering, aggregation, grouping, case comparisons, pagination, numeric serialization, and index selectivity against contract fixtures |
| Delete/retire semantics | Preserve FK restrictions, unsubscribe state, soft retirement, and completed snapshots. Missing source does not universally mean delete |
| Roles | Separate app DML, migration DDL, backup/restore, and read-only diagnostic permissions; never run the web process as schema owner/superuser |

Reject invalid rows into an access-controlled reconciliation report with a reason. Do not silently coerce or discard them. Unresolved loss of learner data or identity blocks cutover.

### 7.4 Repository parity before production

Run the same repository contract fixtures against disposable MySQL and PostgreSQL databases during transition. Cover reads, writes, empty-state behavior, concurrency, duplicates, errors, and transaction rollback. HTTP behavior must remain unchanged while only the persistence adapter differs.

Keep selection of database engine at the composition root, not scattered `if postgres` branches through application rules. During ordinary production operation there is exactly one authoritative writer. The second engine is a migration/test target, not an indefinite dual-write strategy.

Use targeted relational indexes based on observed queries: owned identifiers, review-event idempotency, learner/due state, memberships, progress revisions, and bounded lesson projections. Add JSONB indexes only for documented query paths. Avoid indexing every JSON property or every column.

### 7.5 Rehearsal procedure

1. Inventory the exact source commit, schema checksums, source catalogs, ignored audio assets, durable recordings, environment configuration, and expected counts. Record an immutable migration manifest.
2. Obtain an authorized, consistent backup. Restore it into an isolated rehearsal environment with separate credentials and no public access; sanitize personal data where feasible without destroying important edge cases.
3. Prove the test harness cannot resolve production database/storage endpoints. Require an environment marker in addition to a database-name convention. A variable named `TEST_DB` alone is insufficient protection.
4. Create the PostgreSQL schema from its clean lineage. Run deterministic chunked export/import with stable key order, resumable checkpoints, bounded memory, and explicit type mapping.
5. Reconcile table totals and per-user/per-collection totals; compare canonical row hashes, foreign-key integrity, immutable IDs, event uniqueness, revision values, settings, enrollment, due/mastery state, completed results, and recording checksums.
6. Compare read projections and exercise outcomes using both adapters on the same fixtures. Test interrupted import and safe resumption. Run the importer twice and verify it does not duplicate facts.
7. Rehearse the complete maintenance window, final synchronization, startup, and recovery procedure. Record actual durations and unresolved findings.
8. Repeat with representative large legacy JSON, long review histories, accented aliases, zero-vocabulary grammar paths, retired content, and users with explicit unsubscribe/reset state.

Do not run seed, migration, restore, destructive reset, or test-user creation against production merely to verify a PR.

### 7.6 Production cutover: Express + PostgreSQL first

A named operator authorizes this separately from code review. Use a scheduled maintenance/read-only interval unless a separately designed and verified CDC solution is approved. Zero downtime is not assumed.

**Before the write boundary:** freeze the release manifest and managed content; verify backup restore; fence every source writer including API mutations, admin tools, scheduled imports, one-shot setup, and maintenance scripts. Drain in-flight reviews/recordings and explicitly handle interrupted practice. Capture the final consistent export/checkpoint and complete target reconciliation while the source remains read-only.

**Switch:** deploy the already validated Express + PostgreSQL artifact, initially in non-writing verification mode. Check database identity, schema version, catalog manifest, role privileges, private asset mounts, liveness/readiness, and read-only invariants. Only then enable PostgreSQL writes and record the exact first-write boundary. MySQL remains fenced and preserved, not deleted.

**After switch:** monitor error/conflict/latency and invariant reports, verify operator-approved behavior using isolated validation mechanisms, and keep old application/database artifacts available. Do not manufacture production learner events as a smoke test. Resume content publication only after its PostgreSQL path is verified.

NestJS cutover occurs in a later release on the stable PostgreSQL database. This keeps framework and database regressions distinguishable.

### 7.7 Rollback is different after target writes

Before any PostgreSQL write, rollback may return to the preserved MySQL authority after validating the fencing and release manifest.

After PostgreSQL accepts writes, **pointing the application back to stale MySQL loses new data**. The default is to fence writes and fix forward. A reverse cutover requires a separately rehearsed export/reconciliation/replay of all post-cutover changes, including enrollment, settings, deletions, recordings, and history. It is not an automatic connection-string switch.

Application rollback on PostgreSQL uses a previously tested application artifact with a compatible expanded schema. Prefer expand/contract migrations; delay destructive column/table removal until all relevant old clients/artifacts have expired and recovery has been rehearsed. Restoring a backup without accounting for subsequent writes is not a zero-loss rollback.

## 8. Managed content and media

### 8.1 Separate authoring format from runtime state

Markdown and JSON are authoring/transport formats, not a reason to use a document database for every domain. Keep file-managed content in Git, validate it, publish its database projection deterministically, and preserve learner state independently.

The publisher owns parsing, schema validation, canonical identity resolution, source provenance/hash, version reconciliation, and controlled retirement. The request-serving application should not mutate the schema or repeatedly seed the catalog during normal requests.

Separate three operations that are currently coupled in setup/deployment where applicable: schema migration, managed-content publication, and historical repair. Each needs a lock, version/checksum, idempotency rules, and an auditable result. A completed historical repair should not repeatedly scan a large archive on every unrelated release.

### 8.2 Invariants that survive both migrations

- Collections share canonical vocabulary identities and accepted forms. Enrollment/subscription must not copy all words into per-user progress rows.
- Sparse progress remains sparse. A word not yet studied is not equivalent to a fully populated zero-valued progress record.
- Starting a course and adding its vocabulary to Leitner follow the implemented enrollment contract; adding to Leitner alone must not falsely enroll a user in exercises.
- Removing membership does not erase learning history. Re-adding the same vocabulary must reconnect to the same identity and preserved progress.
- Completed attempts retain their original content/evidence snapshot. Editing current content must not regrade historical results implicitly.
- Array order and stable slide/lesson/exercise identifiers are significant. JSON object formatting is not the identity model.
- Runtime functions, callbacks, framework component classes, and secrets do not belong in serialized slide definitions.
- Learner-facing configuration contains no private IELTS answer keys. Listening exercises reference the owning assessment domain.
- Managed collection missing-file retirement and listening-episode missing-file behavior must remain distinct: generic collection archival rules must not accidentally archive missing episode assets.
- `transcript.md` remains file-only and is never synchronized into the database.

### 8.3 Durable media versus cache

Ignored episode audio and other required runtime assets must be part of a release/media manifest even though they are not committed to Git. The deployment must verify presence and checksum without overwriting operator-managed ignored media automatically.

Attempt-bound recording evidence is durable private data. Ephemeral shadowing buffers and reproducible TTS output have different retention/recovery requirements. Define these classes explicitly rather than deleting an entire `audio` directory under a generic cache policy.

Keep current on-demand Kokoro generation and version-aware filesystem cache. Preserve atomic file publication, safe paths, timeouts, format/voice validation, and cancellation. Do not add pre-generation, Redis, or automatic eviction as an incidental part of this migration. Report disk pressure and stop safely before exhaustion; a separate policy can later define bounded cleanup.

During managed publication, serialize concurrent runs with a database lock and reject checksum conflicts. Preserve source identity when a title changes. Content publication must not reset course progress or restore an intentionally removed subscription.

## 9. Security and persistent authentication

### 9.1 Baseline controls and proof

| Control | Required implementation | Minimum proof |
| --- | --- | --- |
| Production configuration | HTTPS, secure cookies, intentional proxy trust, private database/provider ports; admin DB UI disabled or private | Effective configuration review and negative startup/config tests |
| Authorization | Authenticated account identity from server context; resource ownership on every attempt/recording/progress route; explicit admin policy | Cross-user and non-admin negative tests |
| Request boundaries | Strict DTOs, per-route size limits, bounded query/pagination/upload shapes | Malformed/oversized/unknown-property cases |
| Injection/XSS | Parameterized SQL; escaped/sanitized authored Markdown/HTML; restrictive CSP preserving necessary media behavior | SQL parameter and malicious-content regression tests |
| CSRF/CORS | Explicit CSRF defense for cookie-authenticated mutations; allowed origins validated; no credentialed wildcard | Cross-origin mutation and invalid-token rejection tests |
| Authentication abuse | Bounded login/recovery attempts, consistent errors, password policy, credential and privilege-change revocation | Brute-force/rate-limit and account-enumeration tests |
| Expensive endpoints | Per-user request/concurrency limits for TTS, recordings, uploads, and grading; timeouts and bounded retries | Quota exhaustion/cancellation/provider-failure tests |
| Files and providers | Validate MIME/size/ownership; prevent traversal; fixed allowed provider destinations; no arbitrary user-supplied server fetch URL | Wrong-owner, traversal, unsupported type, and SSRF boundary tests |
| Secrets/supply chain | Environment-only secrets, least-privilege runtime/migrator roles, dependency/image/secret scanning | Clean scan or explicit reviewed exception with expiry |
| Audit/privacy | Redacted security events and explicit retention/deletion controls | No passwords/tokens/answers/audio in routine logs; deletion policy tests |

Do not claim CSP, CORS, a framework, or a WAF alone prevents hacking. Existing Helmet and ownership checks are useful controls to preserve, not proof that the entire application is secure.

A same-origin browser deployment normally does not need permissive CORS. Native packaging introduces another origin/transport decision; resolve it explicitly rather than allowing all origins or trusting an `Origin` header as authentication.

### 9.2 Selected authentication target without Redis

Use **PostgreSQL-backed opaque device sessions** as the initial target. This is simpler than maintaining both stateless access JWTs and a refresh-token service when neither is required by a current external integration.

Store only a cryptographic digest of a high-entropy session credential, with account/device-session identity, creation/last-use times, idle/absolute expiry, revocation, and credential-version metadata. Check revocation and expiry server-side. Limit/coalesce last-used updates to avoid a database write on every request.

For the browser/PWA, deliver the credential in an `HttpOnly`, `Secure`, appropriately scoped cookie and use explicit CSRF protection. Rotate credentials after authentication/privilege changes and through a tested renewal policy; handle concurrent tabs so rotation does not create an unlimited grace window.

Persistent login is a user experience, not permission for a credential to remain valid forever. Define separate policies for remembered learner devices and administrative operations. The initial proposal is a remembered-device policy with bounded inactivity and absolute lifetime, plus recent reauthentication for sensitive operations; exact durations must be approved in the auth work package based on risk and desired UX, not silently copied from a generic example. [OWASP session guidance][x-session] explains server-side expiry, renewal, and invalidation.

Logout revokes the server session and clears the client credential. Provide logout-all-devices and revocation on password reset, account disable/delete, or a security incident. Keep existing password hashes valid during the engine/framework migration; rehash on successful login only through a separate tested policy change.

Transition from existing JWT cookies deliberately: either exchange an unexpired, fully verified token through a bounded migration path with replay/revocation controls, or require one announced re-login. Never accept expired tokens indefinitely to avoid inconveniencing users. Stop issuing the old format at the agreed boundary and remove the compatibility path after its deadline.

For native apps, the same session authority may accept a bearer credential through an explicit native transport adapter, stored in a vetted OS Keychain/Keystore-backed facility. Do not put durable auth secrets in localStorage or treat Capacitor Preferences as secure credential storage. Reject conflicting cookie/bearer identities. Browser and native adapters must not become independent account systems.

### 9.3 Server-authoritative learning commands

Replace client-declared correctness, next box, mastery timestamp, and absolute daily counters with an owned attempt reference, raw answer/action, expected revision, and stable command identifier. The server loads the immutable attempt/content scope and current learning state, assesses the answer, computes the allowed transition and deltas, and commits progress/event/statistics together.

Preserve retry safety: the same command identifier and same payload returns the recorded result without awarding or advancing twice; the same identifier with a different payload is rejected. Do not broaden the current immediate-retry semantics without explicit contract tests and an agreed retention policy for command outcomes.

Preserve legitimate review rules: finite scheduled review, wrong-answer reset timing, distinct House-1 practice, final House-5 mastery, correction versus primary-answer statistics, and existing source-scoped practice behavior. Do not silently rewrite historical learning evidence when introducing stronger commands.

Audit `PUT /api/state`, restore/import, reset, vocabulary edits, and self-report flows for alternate ways to overwrite authoritative state. Limit compatibility permissions and add explicit import provenance. A UI-generated statistic is not sufficient evidence for competitive XP, streaks, or proficiency claims.

### 9.4 Privacy, administration, and incident handling

Implement verified account recovery, administrative least privilege, and stronger reauthentication/MFA for privileged operations as staged security tasks. Email delivery configuration/provider choice must be explicit; do not claim a working reset flow before its delivery and token lifecycle are tested.

Define collection of email, learning history, recordings, diagnostics, and any future social data in a data inventory with retention and deletion responsibilities. Append-only history means ordinary learning writes cannot rewrite history; it is not a blanket exemption from an approved account-erasure process. Deletion must include associated media and any disclosed backup-retention policy. Resolve legitimate retention exceptions with the product/legal owner.

For an incident: fence compromised access, revoke affected sessions/credentials, preserve appropriate redacted evidence, deploy a verified correction, reconcile data, and record the cause and prevention test. Do not rotate credentials or delete user data automatically merely because this playbook describes an incident procedure.

## 10. Branching and automatic delivery

### 10.1 Bootstrap versus normal workflow

This documentation PR is explicitly created **from `main` into `main`** at the owner's request. It is a one-time bootstrap exception to the future dev-only release path. It does not create `dev`, activate rulesets, or deploy anything.

After the playbook is approved, a separately authorized repository-configuration work package creates `dev` from the resulting `main`, installs the trusted checks, verifies them on passing/failing PRs, and then enables protection. Do not enable a required check that has never reported successfully or is skipped for documentation changes.

Normal flow:

```text
feature/*, fix/*, refactor/*, docs/*
               |
               | PR + required CI/review
               v
              dev ---------------------> automatic staging deployment
               |
               | release PR, same-repository dev only
               v
              main --------------------> automatic production deployment
```

Branches for normal work start from current `dev`. `main` accepts PRs only from the repository's own `dev`. Git cannot prevent someone creating a local branch from `main`; the enforceable rule is which changes can be merged/pushed into protected branches.

### 10.2 Required repository protections

Protect both integration branches: no direct pushes, no force pushes/deletion, required PR review and checks, resolved conversations, and checks for the exact current revision/merge candidate. Restrict administration/bypass privileges and audit any emergency use. Workflow/rules/agent-guide changes require appropriate code-owner review.

The `main` source check must validate both `head.ref == dev` and the exact same head repository identity. A fork containing a branch named `dev` must fail.

Run that policy check from trusted base-owned code or an appropriately controlled GitHub App, not executable code supplied by the PR it judges. A metadata-only `pull_request_target` policy check may inspect PR metadata with read-only permissions and **must never check out or execute the untrusted head**. Keep it separate from normal unprivileged build jobs. Protect its source and expected check origin; a PR must not be able to redefine its own gate.

A PR workflow with path filters can leave a required check pending forever, while skipped dependent jobs can mask failures. Use an always-triggered aggregate gate that explicitly evaluates every required job and fails on unexpected failure/cancellation/skips. Select fast documentation checks inside that workflow rather than skipping the required workflow entirely. See [required-check behavior][x-required] and [Actions security][x-actions].

Feature PRs may use squash merging. Release `dev -> main` PRs should preserve ancestry with merge commits. Sync resulting `main` ancestry back to `dev` through a reviewed PR where necessary. Do not combine a mandatory linear-history rule with a release policy that requires merge commits.

### 10.3 Hotfix consequences

The selected dev-only rule has a real tradeoff: a hotfix cannot bypass unreleased changes already on `dev`. Keep incomplete work disabled behind deliberate feature flags or do not merge it to `dev`; otherwise stabilize/revert those changes before releasing the fix through `dev -> main`.

Do not quietly add `hotfix/* -> main` as an exception. Changing that policy requires explicit owner approval and a corresponding protection/runbook change. Keep emergency operator rollback to a previously approved compatible artifact distinct from merging new source code.

### 10.4 CI and artifact promotion

On a PR to `dev`, run the applicable lint/type/architecture/source validators, unit/behavior/regression/contract tests, isolated database integration, security checks, and production builds. On push to `dev`, rerun the required validation for that integration revision, build an immutable release candidate, deploy it to staging automatically, and record readiness/verification evidence.

A release candidate manifest contains source and tree identity, dependency lock identity, application image digest, schema version/checksums, content/media manifest, and the validated staging result. `dev -> main` approval refers to that exact candidate, not merely a branch name.

On push to `main`, validate that the selected artifact corresponds to the approved release content and build inputs, then deploy **that tested artifact** to production automatically. If main's merge changes release-affecting content or no matching candidate exists, fail closed: build and stage a new candidate before production. Do not rebuild an untested image and assume it is equivalent because the source looks similar.

Use non-secret runtime configuration for API base/environment differences so the same application artifact can move between staging and production. If an unavoidable compile-time difference exists, identify, build, and validate each artifact explicitly; do not claim byte-identical promotion.

### 10.5 Environment and deploy isolation

Staging and production have different credentials, databases, session keys, storage/media namespaces, domains, and provider capacity. Staging must never silently use production recording storage or a production database URL. PR jobs receive no production secrets and do not execute on the production host.

Deploy through a least-privilege mechanism: short-lived identity where the hosting provider supports it, otherwise restricted credentials with verified host keys and rotation. Do not invent a cloud provider or change DNS/firewall rules in a normal code PR.

Serialize deployments per environment. Never cancel a running schema migration to make room for a newer commit; only superseded pre-deploy builds may be canceled safely. The database migrator has a single-run lock and separate DDL privileges. The long-lived app uses DML privileges only.

A normal deployment validates the manifest, expands compatible schema, publishes content under its own lock, starts the candidate, waits for readiness, switches traffic, and drains the previous instance. Gate this by available host capacity; a single-host restart with a short maintenance window is preferable to pretending blue/green capacity exists.

Deploy success requires the correct release identity, schema, assets, database readiness, and compatible API responses. A container merely being alive is not success. Keep a tested previous artifact and the appropriate schema/data recovery plan.

## 11. Tests and architecture enforcement

### 11.1 Preserve the current test policy

E2E and Playwright remain disabled, locally and in CI. Do not restore the historical smoke workflow, rename an E2E suite to evade the rule, or run browser scenarios against a non-dedicated database.

Existing HTTP/database integration tests using an isolated ephemeral database are not automatically browser E2E. Preserve their valuable invariants, with explicit database/storage isolation and no route to production. Use pure unit tests, Angular component/harness tests, behavior tests, API/provider/persistence contracts, and deterministic regressions.

Native device acceptance is a separate manual release checklist using isolated test accounts/data. It does not authorize an automated Playwright/E2E suite.

### 11.2 Required regression matrix

| Boundary | Cases that must survive |
| --- | --- |
| Identity/auth | Existing password verification; wrong/expired/revoked sessions; cross-user attempts and recordings; unsafe return URL |
| Review persistence | Exact revision acknowledgment, duplicate/concurrent submission, timeout retry with unchanged command, no false saved state |
| Leitner | Wrong reset timing, due dates/local days, final `5 -> 5` mastery, alias/legacy history repair, sparse unseen words |
| Practice orchestration | Click/Enter parity, IME handling, one active slide, stale callback cancellation, immutable attempt scope |
| Library | Subscribe/unsubscribe/re-add, independent course enrollment, aliases/provenance, missing/retired content policies |
| Learning path | Start/resume/complete, stale revision conflict, parent/route identity, completed snapshots, zero-vocabulary grammar paths |
| Listening/speech | Server grading, attempt ownership, provider failure, recording limits, private assets and range responses |
| Content publication | Invalid schema, duplicate IDs, checksum mismatch, repeat publication no-op, interruption/resume |
| PWA | API responses not cached, old-client compatibility, cache/version skew, no forced mid-practice update |
| Architecture | External production templates/styles, no new owned app JS, constants policy, acyclic imports, one route/slide/state owner |
| Deployment/data | Empty DB and upgraded DB, import reconciliation, app readiness failure, interrupted migration, restore verification |

Preserve the existing box-five, learning-path persistence, listening, home-timeline, and speech integration coverage. Convert engine-specific infrastructure without deleting its behavioral assertions.

### 11.3 Existing versus proposed commands

The inspected package files already define `npm test` in `back/` and `ui/`, `npm run db:verify` in `back/`, and `npm run build:production` in `ui/`. Database commands may touch a database and must run only in the authorized isolated environment or explicit operator workflow.

Root workspace `typecheck`, new AST constant rules, PostgreSQL parity/import verification, release-manifest validation, and native build workflows are **work to implement**, not commands proven to exist today. Add scripts, tests, documentation, and safe environment validation before making them required gates.

Use the task-delivery skill's actual validation selector for implementation changes. Do not replace its result with an informal assertion that documentation or refactoring does not need checks. An unrun required check remains unrun; do not report it as passing.

## 12. Operations, recovery, and performance

### 12.1 Minimum operational baseline without a new monitoring stack

Emit structured, rotated logs with request/correlation ID, release identity, route template, duration, outcome/error code, and provider category. Avoid passwords, session tokens, raw answers, recording contents, and unnecessary personal data.

Expose separate liveness and readiness concepts. Readiness verifies the intended database/schema and essential application initialization; optional speech-provider failure may be a degraded capability rather than failure of all vocabulary access. Restrict detailed diagnostics rather than exposing internal configuration publicly.

Configure basic external uptime/error alerts and disk/backup-age alerts using the existing hosting facilities or a separately selected minimal mechanism. No Prometheus/Grafana installation is required. Logs alone without anyone receiving or acting on failures are not an operational plan.

### 12.2 Backups and recovery

Back up PostgreSQL and durable private media with encryption, restricted access, off-host copies, defined retention, and tested restoration. Reproducible TTS cache can be regenerated; private attempt evidence cannot be assumed reconstructible from source files.

Define database and media consistency boundaries, restore order, app/schema compatibility, and the treatment of account erasure during backup retention. A backup job reporting success does not prove restoration works.

The owner must approve recovery objectives after measuring the rehearsal. Proposed planning objectives are no acknowledged-write loss during the fenced migration, an ordinary-operation backup/PITR strategy appropriate to the tolerated loss window, and a measured restore procedure. Do not advertise a specific uptime/RTO/RPO guarantee before the infrastructure and restore test demonstrate it.

Document recovery from database unavailability, disk exhaustion, expired certificates, bad content publication, provider outage, a bad application release, and a leaked credential. Every action has a named operator and rollback/stop condition.

### 12.3 Workload-based performance gates

Capture a baseline on fixed hardware and a representative isolated dataset: login, home/bootstrap, due-word selection, compact review writes, rapid activation, large library browsing, long learning-path projection, listening submission, and TTS cache hit/miss. Separate network/provider latency from database and application latency.

Measure p50/p95/p99, request/response bytes, SQL query counts, slow plans, pool wait, memory/CPU, lock waits, and error/conflict rates at a declared concurrency. Compare MySQL/Express, PostgreSQL/Express, and PostgreSQL/Nest independently.

Set budgets before each switch. A suggested investigation threshold is a reproducible p95 regression above 10% on critical reads/writes at the same workload; the actual acceptance threshold must account for measurement noise and absolute user impact. This is a proposed project budget, not an observed result.

Do not regress compact mutations into whole-state saves, sparse progress into mass eager rows, bounded queries into N+1 loops, or bulk catalog operations into one query per word. Retain the intent of existing large-data and revision regression fixtures.

Use query plans on isolated data before speculative indexing or caching. Do not execute mutating `EXPLAIN ANALYZE` or synthetic load on production without explicit operational authorization. Redis can be reconsidered only with a measured problem and a separate decision.

## 13. Capacitor and store distribution

### 13.1 What is packaged

Capacitor copies the already-built Angular web assets into native Android/iOS projects and connects web code to native capabilities through plugins. It does not translate Angular templates into native Java/Swift UI widgets. The NestJS backend and PostgreSQL remain hosted services; they are not bundled inside the mobile app. See [Capacitor workflow][x-capacitor].

Add `capacitor.config.ts` and native projects under `ui/` in a dedicated work package. Point `webDir` at the actual Angular browser build output and verify it in CI. Production builds use local packaged assets, not a development `server.url` pointing at a remote dev server.

Keep Angular Material and the existing design system. Implement narrow platform adapters for microphone/recording, notifications, secure credential storage, deep links, sharing, lifecycle, and network status only where a current feature needs them. Do not expose arbitrary native bridge calls to untrusted content.

### 13.2 Native compatibility gate

Before committing to store publication, prove authentication and session renewal/logout on both platforms, including WebView cookie/origin behavior or the explicit native credential adapter. Do not assume browser cookie behavior transfers unchanged.

Verify microphone permissions and denial handling, audio playback/interruptions, Android back navigation and IME keyboard behavior, safe-area insets, accessibility/text scaling, deep-link ownership, app pause/resume, network loss, and restoration without duplicate submissions. Disable web-service-worker registration inside the native shell to avoid two competing asset update owners.

Notifications are opt-in and server/device registrations must be revocable. No sensitive answers or recordings should appear in notification payloads. Permission prompts belong at the point of need, not as an unexplained startup wall.

Keep the current PWA available. Continue excluding private `/api` responses from service-worker caching. Native and older PWA clients can remain installed across server releases; support an explicit API/content compatibility window rather than assuming every client updates with `main`.

### 13.3 Build and distribution pipeline

Use Linux-compatible Android build workers and macOS/Xcode-capable workers for iOS, with pinned compatible SDK/toolchain versions. Keep signing keys/certificates/profiles and store credentials in restricted release environments; never commit them. Native project source is versioned; generated build output is not.

After the native work package exists, CI may automatically build the matching candidate and distribute it to internal Android testing/TestFlight through authorized credentials. Public store submission/release is a separate tagged or explicitly approved release action. A web/API deploy from `main` does not instantly update an installed native binary.

Store review, account verification, SDK requirements, privacy declarations, content rights, and signing setup are external gates. Apple assesses minimum functionality beyond a repackaged website and requires in-app account deletion for apps supporting account creation. Google Play requires an applicable in-app and external account-deletion path and accurate user-data declarations. Recheck the [Apple guidelines][x-apple] and [Google user-data policy][x-google] at submission time.

Do not add a microphone plugin just to claim approval is guaranteed. Present Vocora's actual learning utility, reliable native behavior, and complete account/privacy controls. Confirm developer-account eligibility, distribution regions, legal ownership, and media/content licensing before promising publication. If paid digital features are later added, assess then-current store billing rules separately; no payment architecture is invented here.

## 14. Four-week implementation sequence

This is a target for approximately twenty working days of focused work, not a fixed delivery promise. Work packages can be split further when reviews or data risks require it. Framework, data, and mobile deadlines must not compress the safety gates.

| Window | Intended milestone | Exit gate |
| --- | --- | --- |
| Week 1 | Baseline and threat model; isolated staging; branch/CI bootstrap; shared TypeScript/contracts foundation; first auth-template extraction | A clean reproducible build, isolated tests, trusted merge rules, staging deploy/readiness, exact debt and API inventory |
| Week 2 | PostgreSQL schema/adapter parity; managed-content publication path; representative migration and rollback rehearsals | All identity/data reconciliation checks pass; engine parity and recovery measured; operator approves cutover plan |
| Week 3 | Separate Express + PostgreSQL cutover; stabilize; then Nest bootstrap and incremental route migrations | PostgreSQL is the sole writer; no unexplained data/performance regression; each migrated route passes its contract matrix |
| Week 4 | Complete prioritized Nest/TypeScript/frontend slices; close critical auth/learning authority gaps; production delivery rehearsal; Capacitor isolated beta spike | Remaining debt explicitly listed; security/recovery gates met; web release repeatable; mobile readiness evidence recorded |

Authentication and server-authority design begin in week 1. Their implementation is separate from engine/framework parity commits. A critical exploit finding can interrupt the sequence for a narrowly scoped fix before a wider migration.

Capacitor build/signing investigation can run independently once public contracts are stable, but public store availability is not a month-one acceptance promise. If all legacy code cannot be safely converted within four weeks, extend the plan with a finite inventory; do not call the entire migration complete with hidden grandfathered violations.

## 15. Executable work packages

All packages below are **planned**. Each implementation PR records its package ID, concrete owner/reviewer, base/head, affected contracts, tests, rollback, and evidence. A task authorizes only its selected package/slice, not the rest of the roadmap.

### WP-00: Approve and connect the playbook

**Output:** this root document and a minimal `AGENTS.md` entry pointing agents here. Preserve existing E2E, source-truth, safety, and skill rules.

**Acceptance:** source-backed review, no application/runtime changes, no changed branches/protection other than this documentation branch, and an explicit distinction between planned and implemented work. Merge is a separate owner decision.

### WP-01: Baseline, inventories, and isolated verification

**Depends on:** WP-00 approval. **Surfaces:** existing scripts/tests/docs and environment definition.

**Output:** exact route/ownership and schema-object inventories; remaining JS/inline-template/constants/duplication counts; threat model; deployed configuration and backup inventory obtained with authorization; safe disposable MySQL and PostgreSQL test environments.

**Verify:** baseline application/component/API/database suites on isolated data; preserve current E2E guards; demonstrate production host/database/storage refusal. Record known existing failures rather than normalizing them into passing tests.

**Stop/rollback:** any production connectivity in a test or unknown data owner blocks further work. No runtime behavior change is needed to roll back the inventory.

### WP-02: Branch protection and staging delivery

**Depends on:** WP-01. **Surfaces:** `.github/workflows`, reviewed repository settings, deploy configuration.

**Output:** create `dev` from approved main; trusted same-repository dev-only main check; protected branches; always-reported aggregate CI; isolated automatic staging deployment and readiness.

**Verify:** allowed feature->dev and dev->main cases; reject feature->main, fork-dev->main, direct push, stale/failed checks, and skipped required jobs. Test metadata handling without executing untrusted PR code with secrets.

**Stop/rollback:** preserve current production while staging/settings are introduced. Do not activate production automation until WP-14. A protection change requires an explicit repository owner, not just a source commit.

### WP-03: TypeScript workspace and public contract boundary

**Depends on:** WP-01. **Surfaces:** root workspace/config, `back/`, `ui/`, `packages/contracts`, Docker/CI.

**Output:** compatible pinned toolchain, package exports, strict compiler boundaries, safe constants/contracts package, clean production build paths. Consolidate lock ownership only in the dedicated build transition.

**Verify:** clean-checkout build and tests for both applications; browser bundle contains no backend modules/secrets; compiled app finds assets/data/migrations; import graph remains acyclic.

**Stop/rollback:** do not combine with database switch or grade/schedule changes. Return to the previous build artifact if packaging fails.

### WP-04: First frontend vertical refactor and enforcement

**Depends on:** WP-03. **Surfaces:** auth components, copy/route constants, affected architecture/component tests.

**Output:** external login/register HTML/SCSS, readable TS, scoped constants, AST/template checks and finite legacy baseline. Migrate one feature at a time after this example.

**Verify:** existing auth behavior, safe return navigation, form labels/validation, responsive/keyboard semantics; equivalent checks now read external templates and constant-backed routes.

**Stop/rollback:** do not weaken source-truth assertions or change visual/product behavior. Revert the slice without touching learner data.

### WP-05: PostgreSQL schema lineage and conversion tool

**Depends on:** WP-01 and the required TS tooling. **Surfaces:** `back/database/postgres`, controlled migration scripts, fixture tests.

**Output:** final schema mapping for all 23 MySQL migrations, type/identity/collation mapping, separate checksummed ledger, resumable import and reconciliation report, least-privilege role definitions.

**Verify:** clean schema creation, exact source IDs/parent mappings, repeated import behavior, unsupported-value rejection, sequence allocation, interrupted import recovery, immutable historical MySQL checksums.

**Stop/rollback:** no production writer switch. Any unexplained identity/row/hash discrepancy blocks the package.

### WP-06: PostgreSQL repository and publisher parity

**Depends on:** WP-05. **Surfaces:** persistence adapters and composition, catalog import/publish/verify operations.

**Output:** PostgreSQL adapters for every active repository, including layered learning bootstrap/settings/timeline adapters and the collection-learning-path module; schema/content/repair separation.

**Verify:** both engines against identical contracts; concurrent revisions and command duplicates; library/enrollment/attempt/media ownership; managed publication no-op; missing-source policies; no private keys in public projection.

**Stop/rollback:** MySQL remains the sole production writer. Do not patch callers with engine-specific behavior to hide parity failures.

### WP-07: Data rehearsal and approved cutover runbook

**Depends on:** WP-06. **Surfaces:** isolated restored dataset, migration reports, operator runbook.

**Output:** representative migration timings, per-table/per-user reconciliation, restoration evidence, freeze/fencing checklist, durable-media manifest, clear pre/post-first-write rollback boundary.

**Verify:** two successful repeatable rehearsals including a forced interruption and restore; performance comparison at declared workload; old application compatibility with target schema where required.

**Stop/rollback:** missing backup restore, unknown final-write boundary, or unresolved progress/history discrepancy means no cutover. Return only rehearsal systems to their clean snapshot.

### WP-08: Express + PostgreSQL production transition

**Depends on:** approved WP-07; explicit operator authorization. **Surfaces:** release configuration and previously validated artifact only.

**Output:** fenced single-writer transition under section 7.6; preserved read-only MySQL and backup; release/first-target-write evidence.

**Verify:** read-only reconciliation/readiness before enabling writes, then declared observation criteria and authorized operational verification. No synthetic production learner writes from CI.

**Stop/rollback:** pre-write return to MySQL is allowed by the runbook; post-write recovery must preserve target deltas. Do not start the Nest cutover in the same release.

### WP-09: Nest infrastructure and initial routes

**Depends on:** stable WP-08, WP-03. **Surfaces:** Nest bootstrap/config/modules/HTTP and existing ports.

**Output:** Nest on its Express adapter, canonical errors/headers/security middleware, readiness and graceful shutdown, first read-only route slices. Maintain exact route ownership during transition.

**Verify:** HTTP contract matrix and production container; no duplicate handler or source owner; startup rejects unsafe production configuration.

**Stop/rollback:** previous Express + PostgreSQL artifact remains deployable on the compatible schema.

### WP-10: Finish Nest vertical slices and application TypeScript

**Depends on:** WP-09. **Surfaces:** auth, compact commands, learning paths, listening/speech/TTS and their adapters.

**Output:** migrate one bounded context per PR, preserve shared transaction/context behavior, remove each obsolete JS/router owner when verified; convert owned backend application JS inventory to TS.

**Verify:** existing regression suites and API parity including streaming, CSP, recordings, revision conflicts, provider cancellation, and immutable attempt evidence.

**Stop/rollback:** keep each release backward compatible. Do not combine all contexts into one unreviewable replacement or smuggle in a new learning rule.

### WP-11: Server-authoritative review and compatibility hardening

**Depends on:** WP-01 contracts/threat model; can precede WP-08 for urgent findings. **Surfaces:** review commands, attempt ownership, compatibility state/import endpoints, UI persistence adapter.

**Output:** owned attempt + raw answer commands; server-derived results and deltas; stable command idempotency; restricted alternate write paths; deliberate self-report behavior decision.

**Verify:** forged correctness/box/counter rejection, cross-user rejection, replay/conflict/concurrent submission, stale old client, import/reset boundaries, and unchanged valid learning transitions.

**Stop/rollback:** never re-enable an integrity bypass silently. Plan client compatibility/feature disable behavior before enabling the new authority model.

### WP-12: Revocable persistent sessions and account controls

**Depends on:** auth contract design; PostgreSQL target for final session store. **Surfaces:** auth module, session schema, cookie/CSRF/native transport, account controls.

**Output:** opaque device sessions, approved expiration/renewal policy, logout/all-device revocation, bounded JWT transition, recovery/re-authentication, account deletion and media-retention behavior.

**Verify:** stolen revoked credential rejection, concurrent renewal, expiry, password reset/disable, session fixation, CSRF, cookie scope, failed delivery/recovery, and deletion of associated data under the approved policy.

**Stop/rollback:** no infinite legacy JWT grace period; no restoration of a compromised session to avoid a user re-login.

### WP-13: Complete frontend debt inventory

**Depends on:** WP-04; coordinate with WP-10/11 contracts. **Surfaces:** remaining UI features/application/shared code and tests.

**Output:** external production templates/styles, scoped constants, readable methods, no duplicate route/slide/state owner, TypeScript-only owned app code, preserved central themes.

**Verify:** all affected component/behavior/architecture regressions, zero new violations throughout, zero remaining unapproved application violations at completion; old cache/client compatibility maintained.

**Stop/rollback:** no broad visual redesign or abandoned regression fixtures. Revert feature slices independently.

### WP-14: Production automation and recovery sign-off

**Depends on:** staging WP-02, data recovery WP-07/08, compatible deploy artifacts and security gates.

**Output:** exact-artifact promotion, automatic main deploy, serialized migrations/deployments, media/schema/content manifest checks, graceful traffic switch, redacted logs/alerts and verified backups.

**Verify:** fail staging readiness, wrong artifact/schema, concurrent deploy, missing asset, provider outage, and application rollback against compatible schema in isolated rehearsals. Verify no PR/fork job can use production secrets.

**Stop/rollback:** disable automatic progression when verification fails, retain the previous approved serving release, and follow the correct data boundary rather than force-deploying green containers.

### WP-15: Capacitor proof and isolated mobile beta

**Depends on:** stable public/auth contracts; not a dependency for PostgreSQL cutover. **Surfaces:** UI native projects/platform adapters and protected native CI.

**Output:** signed reproducible Android/iOS candidates, native auth/microphone/lifecycle proof, isolated manual device checklist, store-readiness inventory and account-deletion path.

**Verify:** actual supported devices/platforms and network/permission cases; native credentials protected; no web SW/native asset conflict; backend retains compatibility with older installed clients.

**Stop/rollback:** public submission remains blocked by missing signing/account/policy/privacy evidence. Keep the functioning web/PWA release; do not promise public store approval within this package.

## 16. Agent operating contract and completion gates

### 16.1 Every future task

Read `AGENTS.md`, this playbook, `.agents/AGENTS.md`, and the smallest applicable domain/source documentation. Apply the current principle-selection and task-delivery/review workflow. Inspect source rather than importing outdated branch assumptions or old conversation instructions.

Identify the selected work package, current phase, owning module, public contracts, migration impact, and rollback before editing. A request for a feature is not authorization to execute the whole roadmap. Follow the currently active branch policy: bootstrap rules until explicitly installed, dev-based work afterward. Never infer permission to merge, deploy, delete branches, reset data, or change OKF.

Use one source owner per concern and the smallest coherent PR. Tests must demonstrate the specific behavior/invariant being preserved or changed. Update documentation, contracts, and architecture enforcement with the owning implementation. Do not put a target file/path into the implemented inventory before it exists and is verified.

An exception record must identify rule, scope, reason, owner/reviewer, expiry or removal work package, and verification. A known security/data-integrity failure cannot be waived with a vague temporary comment.

### 16.2 Implementation status record

Keep status updates in this document's work-package references or an explicitly created execution ledger linked from here. Do not rewrite the historical audit snapshot as if it described the new implementation.

Use these states: `planned`, `in_progress`, `blocked`, `verified`, `released`. A verified state requires exact commit/test evidence; released additionally requires the corresponding environment/release identity. No package is marked verified merely because its PR exists.

### 16.3 Final migration acceptance

- [ ] PostgreSQL is the sole authoritative production store; exact IDs, history, enrollment, recordings, and source provenance reconcile.
- [ ] The backup/restore and post-target-write recovery paths have been rehearsed and have named operators.
- [ ] Nest owns the active HTTP/application composition; obsolete legacy route/business owners are removed, not hidden.
- [ ] Owned frontend/backend application code is TypeScript; all production Angular templates/styles are external.
- [ ] Runtime strings follow scoped named ownership; remaining exceptions are explicit and limited to valid syntax/data/tooling categories.
- [ ] Shared contracts are browser-safe; private answers, credentials, and persistence entities are not bundled into the UI.
- [ ] Server authority, authorization, revocation, CSRF, production configuration, and sensitive upload/provider limits pass their negative tests.
- [ ] Required non-E2E regressions, architecture checks, source validators, and compatible production builds pass on the exact release identity.
- [ ] Feature->dev->main policy is enforced; staging/prod are isolated; only validated immutable artifacts reach production.
- [ ] PWA/older-client compatibility, canonical routes, slide ownership, themes, and valid learner behavior are preserved.
- [ ] Operational alerts, redacted logs, retention, and restore verification are active without requiring Redis or Prometheus.
- [ ] Mobile beta readiness and public store readiness are reported separately; neither is assumed from a successful web build.
- [ ] Outstanding risks and deferred product decisions are visible; no unverified capacity/security/compliance guarantee is claimed.

## 17. Branch inventory and development history

### 17.1 Complete observed branch snapshot

The initial inventory contained **28 branches** and **20 distinct non-main tips**. Every distinct non-main tip was compared against the pinned audit main `3ec8c87ffc6c6325441cabf32aaa84992dfca06a`. Counts below deliberately remain tied to that commit, not a moving branch name.

The final pre-write refresh contained **27 branches**: `codex/inspect-cloze-slide` had disappeared after its work entered main, and main had advanced to `3908ae64c9b5969f475df48ea6a536f68bb18ae5`. The other listed tips were unchanged. This documentation branch is not included in either pre-write snapshot. No branch was deleted by this task.

`behind` means the tip is an ancestor of the audit main. `diverged` means unique commits exist; it does not prove their behavior is still needed. All observed branches were reported unprotected; no `dev` existed. Reference suffixes below retain enough context for readers, while the full tips are recorded for reproducibility.

| Branch | Tip SHA | Ahead / behind audit main | Finding |
| --- | --- | --- | --- |
| `agent/library-normalized-vocabulary-ci` | `7a50900279f3cac6442be8d3e4c87894fe5e319a` | 0 / 1810 | Ancestor |
| `agent/library-normalized-vocabulary-temp` | `7a50900279f3cac6442be8d3e4c87894fe5e319a` | 0 / 1810 | Same historical tip |
| `agent/library-normalized-vocabulary-work` | `7a50900279f3cac6442be8d3e4c87894fe5e319a` | 0 / 1810 | Same historical tip |
| `agent/review-retry-progress` | `e1aa91f1af73a9ff24621bc0cdea97145b0464a7` | 2 / 1829 | Diverged; legacy UI retry work |
| `agent/same-session-spelling-repair` | `c29556ee5ccd68777520c285d1d0f8589a6469e9` | 0 / 1853 | Ancestor |
| `bundle-work/latest-10-missing-20260905` | `dac865908988816aa9c85691a63ded7e9343ba7d` | 2 / 716 | Diverged; temporary workflow |
| `bundle-work/latest-ten-20260905` | `08dd87213cf307cd0e74b09cbf7d24a4b54ead45` | 1 / 716 | Diverged; temporary workflow |
| `bundle-work/next10-ielts-20260905` | `c01de48dc7a609d292a9454287defdbf331aec94` | 2 / 687 | Diverged; two temporary workflows |
| `bundle-work/20260801-20260810-20260905` | `ff654d86c76ef40a8a913a721b2be2b5bd3f4424` | 2 / 716 | Diverged; temporary workflow |
| `codex/inspect-cloze-slide` | `990730916a47224a1f8fdfa5e6765f57ba1d0c08` | 0 / 1 | PR 146 ancestor; absent on refresh |
| `codex/reusable-slide-library` | `16a71d4281bfa8d2c6f1de208b7335ba32522ad8` | 0 / 186 | Ancestor |
| `feat/library-copy-import-template` | `331040006185b35670a77c978f4554710fa421bb` | 0 / 1529 | Ancestor |
| `feat/library-copy-import-template-testprobe` | `331040006185b35670a77c978f4554710fa421bb` | 0 / 1529 | Same historical tip |
| `feat/listening-daily-goal` | `ca5cfa879535f68646b171a330f3aa04f1e51431` | 0 / 546 | Ancestor |
| `feat/vocora-pwa-brand-icons` | `35a00b4c24f2d1ab82b85d089889b96d5d9763c7` | 0 / 622 | Ancestor |
| `fix/angular-leitner-house-status-visual-v2` | `20a3931b72f83f8e29d36bca6facc3267cca494c` | 0 / 1364 | Ancestor |
| `fix/ielts-listening-question-redesign-backup` | `f176e5cdadfdd827846fc085d92d2971a50228a5` | 5 / 711 | Diverged; old authoring skill/workflow |
| `fix/ielts-listening-question-redesign-old-work` | `f176e5cdadfdd827846fc085d92d2971a50228a5` | 5 / 711 | Same divergent backup |
| `fix/ielts-listening-question-redesign-rebased` | `314312b70ab04d8684cdabe5da002de793c6b8cb` | 0 / 695 | Successor ancestor |
| `fix/shadowing-e2e-microphone-ci` | `fb442a0e21a42ac66368d5414fa5ad83e1a7ca9b` | 0 / 684 | Historical ancestor; current E2E ban wins |
| `lp-10-shadowing-exercise-rebase` | `6933e68f1c7ee8d4f84688744c188ff9bf99a47b` | 0 / 409 | Ancestor |
| `main` | `3ec8c87ffc6c6325441cabf32aaa84992dfca06a` | 0 / 0 | Comparison anchor; refreshed tip recorded above |
| `sync/learning-path-into-quick-review-fix` | `7566fe6091aef3b40062a30c4f74b522ce471521` | 0 / 326 | Ancestor |
| `tmp/sentence-word-highlight-rebase` | `90f608f64d2b013eaa085340fd3370526ecf0c1d` | 0 / 511 | Ancestor |
| `tmp-do-not-use` | `f8ecde9d678f6785c69526737ded0cf3a691c0e8` | 0 / 1762 | Historical temporary tip |
| `tmp-review-persistence-final-base` | `f8ecde9d678f6785c69526737ded0cf3a691c0e8` | 0 / 1762 | Same historical tip |
| `tmp-review-persistence-squash-base` | `f8ecde9d678f6785c69526737ded0cf3a691c0e8` | 0 / 1762 | Same historical tip |
| `tmp-review-persistence-squash-target` | `f8ecde9d678f6785c69526737ded0cf3a691c0e8` | 0 / 1762 | Same historical tip |

For reproducible comparison, use `https://github.com/OkBayat/vocora/compare/3ec8c87ffc6c6325441cabf32aaa84992dfca06a...<full-tip-sha>` with a recorded tip. Refresh branch existence before any later cleanup; this table is historical evidence, not deletion authorization.

### 17.2 Divergent work disposition

Seven branch names represent six distinct divergent tips. Inspect their patch semantics before retaining or retiring anything:

- `agent/review-retry-progress` changes deleted legacy `ui/app-v2.js` and its old test. Later scheduled single-pass behavior and the Angular cutover supersede this architecture. Do not merge it to dev automatically.
- The four `bundle-work` tips add temporary BBC workflow files, not a separate active application architecture. Preserve any useful authored outcomes through the current managed-content workflow; do not reactivate old execution workflows blindly.
- The two IELTS backup names share old `vocora-bbc-listening-bundles` skill/reference changes plus a temporary authoring workflow. Their rebased successor is already an ancestor. Review any unique content guidance against the current K2-renamed skill before deciding that all differences are redundant.

Do not merge all old branches into dev. Create dev from the approved main and explicitly port only still-needed, reviewed changes. Branch archival/deletion is a separate authorized task.

### 17.3 Development chronology that informs the architecture

The PR review covered descriptions/metadata for **#1 through #146**, not 146 independently reproduced builds. Not every historical proposal was merged. These transitions explain why a preservation-first migration matters:

| Stage | Representative PRs | Architectural lesson |
| --- | --- | --- |
| Browser learning -> authenticated server | [#2](https://github.com/OkBayat/vocora/pull/2) | Express/MySQL, injected boundaries, cookie auth, optimistic state revisions |
| Normalized library and learning state | [#15](https://github.com/OkBayat/vocora/pull/15), [#16](https://github.com/OkBayat/vocora/pull/16) | Shared identities, sparse progress, immutable migration checksums; real large-JSON data exposed a sort-memory issue |
| One practice workflow owner | [#20](https://github.com/OkBayat/vocora/pull/20) | Multiple DOM/state owners caused recurring transition bugs |
| Durable compact writes | [#22](https://github.com/OkBayat/vocora/pull/22), [#23](https://github.com/OkBayat/vocora/pull/23), [#25](https://github.com/OkBayat/vocora/pull/25), [#31](https://github.com/OkBayat/vocora/pull/31) | Exact acknowledgment and small commands matter more than a framework label |
| Leitner rule and historical repair | [#24](https://github.com/OkBayat/vocora/pull/24), [#26](https://github.com/OkBayat/vocora/pull/26), [#28](https://github.com/OkBayat/vocora/pull/28), [#33](https://github.com/OkBayat/vocora/pull/33) | Single-pass scheduled review, final mastery evidence, preserved legacy archive, fair House-1 coverage |
| Full Angular migration | [#38](https://github.com/OkBayat/vocora/pull/38), [#39](https://github.com/OkBayat/vocora/pull/39), [#42](https://github.com/OkBayat/vocora/pull/42) | Existing Angular/Material/English-LTR/Bootstrap is the baseline; closed Material Web PR #36 is not the target |
| PWA and managed sources | [#52](https://github.com/OkBayat/vocora/pull/52), [#63](https://github.com/OkBayat/vocora/pull/63), [#65](https://github.com/OkBayat/vocora/pull/65) | Cache/private API separation, source provenance, episode lifecycle and file-only transcripts |
| Speech and daily activity | [#71](https://github.com/OkBayat/vocora/pull/71), [#76](https://github.com/OkBayat/vocora/pull/76), [#83](https://github.com/OkBayat/vocora/pull/83) | Private provider boundaries, local-day semantics, source-backed assessment policy |
| Collection learning-path phases | [#94](https://github.com/OkBayat/vocora/pull/94), [#95](https://github.com/OkBayat/vocora/pull/95), [#111](https://github.com/OkBayat/vocora/pull/111), [#112](https://github.com/OkBayat/vocora/pull/112) | Relational progress plus JSON definitions, reusable domains, immutable scope, bounded projections and revision conflicts |
| Agent principles and durable knowledge | [#110](https://github.com/OkBayat/vocora/pull/110), [#118](https://github.com/OkBayat/vocora/pull/118), [#124](https://github.com/OkBayat/vocora/pull/124), [#127](https://github.com/OkBayat/vocora/pull/127) | Reuse canonical K2 guidance; OKF changes stay explicitly requested |
| Reusable slides and stable routes | [#116](https://github.com/OkBayat/vocora/pull/116), [#126](https://github.com/OkBayat/vocora/pull/126), [#128](https://github.com/OkBayat/vocora/pull/128) | One interaction registry; IDs and parent relationships are persistent contracts |
| TTS, recordings, enrollment | [#130](https://github.com/OkBayat/vocora/pull/130), [#131](https://github.com/OkBayat/vocora/pull/131), [#136](https://github.com/OkBayat/vocora/pull/136) | On-demand filesystem TTS cache differs from durable private evidence; course enrollment differs from Leitner membership |
| Current testing and learning evolution | [#143](https://github.com/OkBayat/vocora/pull/143), [#144](https://github.com/OkBayat/vocora/pull/144), [#146](https://github.com/OkBayat/vocora/pull/146) | Absolute E2E ban supersedes #137; zero-vocabulary paths are valid; new slide-based Leitner writes must stay durable/idempotent |

Historical `voco` and `learning-path` integration work reached main; those names were not present in the refreshed branch inventory. Do not keep using `learning-path` as the base for new enterprise migration tasks after the owner installs the new dev policy.

## 18. Audit evidence and limitations

### 18.1 Inspection scope

This was a connector-based source/history architecture audit: repository metadata, all observed branch tips and their ancestry/divergent file scopes, PR history descriptions, root/targeted trees, agent instructions and selected principle references, package/build/deployment/test configuration, database migration inventory, domain documentation, composition/HTTP code, concrete review persistence code, and representative Angular architecture debt.

Source files were read at immutable commits. The initial baseline was `27fdc64ee5e75e4dd04b7f82cfcccb60374338f7`; PR 146 moved main to `3ec8c87ffc6c6325441cabf32aaa84992dfca06a` during inspection. Its changed-file inventory was incorporated. A final refresh found `3908ae64c9b5969f475df48ea6a536f68bb18ae5`; the [two-commit comparison][r-refresh] affects only eight UI builder/rendering/test files. The [last commit][r-latest] fixes Markdown emphasis handling, reinforcing the need to preserve escaped-content rendering tests during refactoring.

Branches and PR descriptions are historical evidence, not proof that a current production deployment contains a change. Current source takes precedence over old PR prose and stale documentation.

### 18.2 Unperformed verification

The documentation audit did not run application builds, package installation, unit/integration tests, E2E, database migration, load tests, production configuration checks, or restore drills. A full local checkout was unavailable in the execution environment. The repository's executable task-delivery/validation selector and independent pre-push review were not executed; no result is invented for them. The documentation PR must disclose these review/verification limitations.

No live production database or customer data was accessed. This is not a penetration-test certificate, exhaustive line-by-line security review, or a measured scaling study. WP-01 and the subsequent gates deliberately close these verification gaps before implementation and production claims.

### 18.3 Pinned repository references

[r-back-package]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/back/package.json
[r-ui-package]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/ui/package.json
[r-container]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/back/src/container.js
[r-app]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/back/src/createApp.js
[r-login]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/ui/src/app/features/auth/login-page.component.ts
[r-ui-tests]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/ui/tests/test-angular-architecture.mjs
[r-compose]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/docker-compose.yml
[r-deploy]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/scripts/deploy.sh
[r-ci]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/.github/workflows/test.yml
[r-review-command]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/back/src/application/learning/RecordReviewResult.js
[r-review-repository]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/back/src/infrastructure/persistence/mysql/MySqlReviewProgressRepository.js
[r-route-ids]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/back/database/migrations/020_learning_path_route_public_ids.sql
[r-domains]: https://github.com/OkBayat/vocora/blob/3ec8c87ffc6c6325441cabf32aaa84992dfca06a/okf/project/vocora-domain-boundaries.md
[r-refresh]: https://github.com/OkBayat/vocora/compare/3ec8c87ffc6c6325441cabf32aaa84992dfca06a...3908ae64c9b5969f475df48ea6a536f68bb18ae5
[r-latest]: https://github.com/OkBayat/vocora/commit/3908ae64c9b5969f475df48ea6a536f68bb18ae5

## 19. External references

Official references consulted on 2026-09-10. Recheck version/toolchain/store policies in the owning implementation PR. The concrete architecture, priorities, acceptance gates, and work-package schedule above are Vocora design proposals, not performance promises from these sources.

- [NestJS module composition and provider boundaries][x-nest].
- [Angular version compatibility][x-angular].
- [PostgreSQL JSON/JSONB representation and indexing][x-json].
- [OWASP session management][x-session].
- [GitHub required status-check behavior][x-required].
- [GitHub Actions secure-use guidance][x-actions].
- [Capacitor build/sync/native workflow][x-capacitor].
- [Apple App Review Guidelines][x-apple], especially minimum functionality and account controls.
- [Google Play User Data policy][x-google], including account deletion and disclosure.

[x-nest]: https://docs.nestjs.com/modules
[x-angular]: https://angular.dev/reference/versions
[x-json]: https://www.postgresql.org/docs/current/datatype-json.html
[x-session]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
[x-required]: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
[x-actions]: https://docs.github.com/en/actions/reference/security/secure-use
[x-capacitor]: https://capacitorjs.com/docs/basics/workflow
[x-apple]: https://developer.apple.com/app-store/review/guidelines/
[x-google]: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
