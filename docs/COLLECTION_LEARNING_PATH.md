# Collection Learning Path Architecture

Status: **architecture locked for phased implementation**

This document is the source of truth for Vocora's collection-scoped Learning Path feature. It records the architecture agreed before implementation so later pull requests can be small, testable, and composable without repeatedly redesigning the feature.

The user-facing feature name is **Learning Path**. Internally, use **Collection Learning Path** wherever needed to distinguish it from the existing Home daily timeline.

## 1. Product intent

A vocabulary book, podcast series, course, or similar collection can expose a structured learning journey. A learner enters the collection and progresses through ordered lessons. Each lesson contains ordered exercises. Exercise implementations are reusable components driven by persisted definitions rather than lesson-specific code.

Examples:

- `BBC 6 Minute English`: one podcast episode becomes one lesson. New episodes can append new lessons over time.
- `Vocabulary for IELTS Intermediate`: units/lessons become a finite ordered course.
- `Vocabulary for IELTS Advanced`: another finite ordered course using the same engine.
- `American English File 3` and `American English File 4`: their existing collection structure can later be mapped into learning-path lessons.
- Future collections may contain reading, grammar, writing, video, image, puzzle, music, or other exercise types without changing the Learning Path engine.

The Learning Path engine is an orchestrator. It must not duplicate Leitner, Listening, Shadowing, Sentence Practice, or any other established domain.

## 2. Explicit non-goals

Phase implementation must not:

- replace the existing Home daily timeline;
- turn `collection_sections` into learning-path lessons;
- create a second vocabulary-progress or Leitner system;
- create a second listening-attempt/grading system;
- create a second Shadowing engine;
- copy shared vocabulary identities per course or per learner;
- store IELTS answer keys in learner-facing exercise configuration;
- couple Domain/Application code to Express, MySQL, or Angular;
- introduce an Angular `NgModule` only to call the feature a module;
- make the first BBC implementation a BBC-specific Learning Path engine.

## 3. Relationship to the existing Home timeline

Vocora already has a chronological Home daily timeline at `/dashboard`. It records practice by calendar day and is documented in `docs/HOME_TIMELINE.md`.

That feature remains independent and unchanged by default.

```text
Home Daily Timeline
    = chronological daily activity history and launch points

Collection Learning Path
    = ordered course/collection lessons and exercises
```

The two features may later link to each other, but neither owns the other's state model.

## 4. Existing Vocora capabilities to reuse

The implementation must reuse current source-of-truth behavior rather than create parallel mechanisms.

### Library and collections

Existing shared content and user subscriptions remain authoritative:

- `collections`
- `collection_sections`
- `collection_entries`
- `vocabulary_entries`
- `vocabulary_forms`
- `user_collections`

A Learning Path belongs to a collection but is not the collection itself.

### Vocabulary and Leitner

Existing `user_vocabulary_progress`, review events, practice sessions, and vocabulary activation rules remain authoritative. A lesson can scope which vocabulary should be introduced or practised, but it must not own duplicate vocabulary progress.

### Listening

Existing listening lessons, episode assets, tests, attempts, and server-side grading remain authoritative. A Learning Path listening exercise references an existing listening lesson/test. It does not copy questions or answer keys into the Learning Path definition.

### Shadowing

Existing Shadowing session, recording, speech-processing, assessment, and progress behavior remain authoritative. A Learning Path Shadowing exercise is an adapter around that capability.

### Sentence Practice and other established practice modes

Existing domains remain independently usable outside Learning Path. Learning Path adapters may invoke them but must not make those domains dependent on Learning Path.

## 5. Core domain language

### Collection

An existing Vocora collection. A collection can optionally expose one active Learning Path in the initial implementation.

### Learning Path

The ordered course definition for a collection. It owns lesson ordering and content-version metadata, not the internal rules of each exercise domain.

### Lesson

An ordered unit inside a Learning Path. A lesson owns an ordered list of exercise definitions and course-level progress semantics.

A Learning Path lesson is **not** the same concept as a `collection_section`. A lesson may reference a section, a listening episode, explicit vocabulary, or another source.

### Exercise Definition

Persisted, immutable-in-identity configuration describing what kind of exercise appears at a given lesson position and what source/configuration it uses.

### Exercise Type

A stable namespaced identifier such as:

- `vocabulary.intake`
- `vocabulary.quick-review`
- `vocabulary.mastery-check`
- `listening.ielts`
- `speaking.shadowing`

Future examples can include:

- `grammar.fill-gap`
- `reading.article`
- `writing.task`
- `video.watch`
- `image.match`
- `puzzle.words`
- `music.listen`

### Exercise Context

The runtime input passed to an exercise renderer/adapter. It contains path, lesson, exercise definition, learner progress, hydrated source data, and permissions needed for the exercise.

### Exercise Outcome

The normalized result emitted by an exercise implementation to the Learning Path orchestrator. An outcome reports whether the exercise completed, was cancelled, or failed, plus evidence/summary references where applicable.

An exercise component does not directly mark a lesson complete.

### Evidence

Server-verifiable proof that an exercise's completion requirements were satisfied. Examples include a submitted listening attempt, a persisted vocabulary-practice session, or a completed Shadowing assessment.

### Resume Point

The first currently actionable incomplete exercise for a learner. Resume is derived from persisted progress and path content, not from client-local navigation history.

### Content Version

A version identifying the synchronized course definition. It supports safe evolution while preserving stable learner progress.

## 6. Course modes

Learning Paths support two modes from the start.

### Finite

Used for books/courses whose planned lesson set has an end.

Examples:

- Vocabulary for IELTS Intermediate
- Vocabulary for IELTS Advanced
- American English File 3
- American English File 4

A learner can reach a stable `completed` course state.

### Rolling

Used for continuously published series.

Examples:

- BBC 6 Minute English
- VOA series
- other podcast feeds

A rolling course uses `up_to_date` semantics rather than treating a learner as permanently completed. When new lessons are synchronized, a previously up-to-date learner receives a new resume point without losing historical completion.

## 7. Ordering and progression model

Version 1 is intentionally sequential. Do not introduce a graph/DAG dependency engine unless a future product requirement requires branching prerequisites.

```text
Exercise 1
    -> Exercise 2
    -> ...
    -> final required exercise
    -> Lesson complete
    -> next Lesson available
```

Conceptual learner states:

- `available`
- `in_progress`
- `completed`

`locked` is preferably derived from prerequisites/order rather than persisted as an independent mutable state.

Optional exercises may exist later through `required = false`; lesson completion depends on all required exercises, not necessarily every optional exercise.

The server is authoritative for progression.

## 8. Completion rules

### Exercise completion

Exercise completion is accepted only through its application-layer completion policy.

For exercises with verifiable external evidence, a client cannot complete the exercise by merely sending `completed: true`.

Examples:

```text
listening.ielts
    -> submitted listening attempt must exist and match the configured test

speaking.shadowing
    -> required persisted Shadowing evidence must exist

vocabulary.quick-review
    -> required scoped practice evidence must exist
```

Some future lightweight exercises may legitimately use an explicit completion command if their policy has no stronger evidence source.

### Lesson completion

The UI never sends a trusted `complete lesson` assertion. The backend derives lesson completion after required exercise completion.

### Path completion

Finite path completion is derived after all required lessons are complete.

Rolling paths derive `up_to_date` when all currently published required lessons are complete.

## 9. Exercise definition contract

The persistence model separates stable/queryable columns from type-specific JSON.

Conceptual shape:

```ts
interface ExerciseDefinition<TConfig = unknown> {
  id: string;                 // decimal public route id in API views
  lessonId: string;
  position: number;
  type: string;               // namespaced stable type
  schemaVersion: number;
  required: boolean;
  completionPolicy: string;
  config: TConfig;
}
```

Example vocabulary intake definition:

```json
{
  "type": "vocabulary.intake",
  "schemaVersion": 1,
  "config": {
    "scope": {
      "kind": "listening-episode",
      "ref": "episode-public-id"
    }
  }
}
```

Example IELTS listening definition:

```json
{
  "type": "listening.ielts",
  "schemaVersion": 1,
  "config": {
    "lessonSlug": "episode-slug",
    "testId": "stable-test-id"
  }
}
```

The definition stores references, not copied listening answer keys or duplicated domain state.

Every exercise type owns validation of its own `config` and `schemaVersion`.

## 10. Exercise runtime contract

Exercise implementations share an external lifecycle while remaining internally independent.

Conceptual runtime input:

```ts
interface ExerciseContext<TConfig = unknown, TPayload = unknown> {
  path: LearningPathSummary;
  lesson: LearningPathLessonSummary;
  exercise: ExerciseDefinition<TConfig>;
  progress: ExerciseProgressView;
  payload: TPayload;
}
```

Conceptual normalized outcome:

```ts
type ExerciseOutcome =
  | { kind: 'completed'; evidence?: unknown; summary?: unknown }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: string };
```

These are architecture-level contracts; exact TypeScript names can be refined in Phase 1 tests, but the responsibilities are locked:

1. Learning Path owns orchestration.
2. Exercise type owns exercise-specific behavior.
3. Exercise renderer emits an outcome.
4. Backend validates/records completion.
5. Backend derives next unlock, lesson completion, and resume state.

## 11. Exercise Registry and Open/Closed Principle

Angular uses an Exercise Registry to map stable exercise types to lazy renderers.

Conceptually:

```text
exercise.type
    -> Exercise Registry
    -> lazy Angular exercise component
```

Adding a new exercise type should require:

- its domain/application configuration validation where needed;
- its adapter/service behavior;
- its Angular renderer;
- its focused tests;
- registry registration.

It must not require modifying lesson progression logic, BBC-specific code, or unrelated exercise components.

Unknown exercise types must fail gracefully with an explicit unsupported state; the page must not crash or silently auto-complete the exercise.

## 12. Angular architecture

Vocora currently uses standalone Angular. Collection Learning Path is a logical feature module/bounded context, not a legacy `NgModule`.

Planned ownership:

```text
ui/src/app/
├── domain/
│   └── collection-learning-path/
├── application/
│   └── collection-learning-path/
├── core/
│   └── collection-learning-path/
└── features/
    └── collection-learning-path/
        ├── path-page/
        ├── exercise-runner/
        ├── components/
        └── exercises/
```

Exact folders can follow the nearest current Vocora convention during implementation, but dependency direction must remain clear.

### Mandatory Angular component rules

Every new or substantially rewritten Learning Path component must use separate files:

```text
<name>.component.ts
<name>.component.html
<name>.component.scss
<name>.component.spec.ts
```

Do not use inline `template` or inline `styles` for Learning Path components.

Also require:

- standalone components;
- `ChangeDetectionStrategy.OnPush` unless a documented technical reason prevents it;
- Angular Signals where appropriate for local/derived state;
- typed service boundaries;
- accessible semantic controls;
- no manual DOM scripting for normal UI state;
- lazy loading for exercise implementations where practical;
- existing design tokens and Vocora UI conventions rather than isolated styling systems.

If an existing component must be substantially changed to integrate Learning Path and currently has inline template/styles, move the touched template/styles into separate files as part of that focused integration change.

## 13. Backend architecture

The backend must preserve Vocora's existing layer separation:

```text
Domain
    -> Application
        -> ports/interfaces

Infrastructure
    -> implements ports

HTTP Interface
    -> translates HTTP to Application commands/queries
```

Planned logical bounded context:

```text
back/src/
├── domain/collection-learning-path/
├── application/collection-learning-path/
│   ├── commands/
│   ├── queries/
│   └── ports/
├── infrastructure/
│   ├── persistence/mysql/collection-learning-path/
│   └── content/collection-learning-path/
├── interfaces/http/collection-learning-path/
└── modules/collection-learning-path/
```

`modules/collection-learning-path/` is the composition boundary. It can create and wire repositories, handlers, services, and the HTTP adapter for Express today.

### Forbidden backend coupling

- Domain must not import Express, MySQL, HTTP DTOs, or filesystem adapters.
- Application must not contain SQL or Express request/response objects.
- Infrastructure must not decide product progression rules that belong in Domain/Application.
- HTTP handlers must not implement business rules that belong in command/query handlers.

## 14. NestJS migration boundary

The current backend remains Express during this project. It must be structured so a future NestJS migration replaces framework wiring rather than rewrites the domain.

Today:

```text
Express Router
    -> command/query handlers
    -> domain/services
    -> repository ports
    -> MySQL adapters
```

Future:

```text
Nest Controller / Nest Module / Providers
    -> same command/query responsibilities
    -> same domain rules
    -> same repository contracts
    -> same or migrated persistence adapters
```

Do not add NestJS decorators, Nest-specific abstractions, or a Nest dependency now. Migration readiness comes from clean ports, dependency inversion, explicit handlers, and framework-neutral application logic.

## 15. CQRS contract

All new Collection Learning Path reads and writes use explicit Query/Command separation.

Initial query responsibilities include:

- get a collection's Learning Path;
- get a lesson;
- get hydrated exercise context;
- get the learner's resume point;
- get path/lesson progress views.

Initial command responsibilities include:

- start/activate a Learning Path for a learner when needed;
- start an exercise when start evidence is useful;
- complete/submit an exercise through its policy;
- apply synchronized course-content changes through an administrative/content process, not learner commands.

Do not create a client-authoritative `CompleteLessonCommand` merely for convenience. Lesson completion is derived.

Exact handler names and endpoint paths can be finalized when Phase 3 implements and tests the API; the CQRS ownership above is locked.

## 16. Persistence model

The planned relational model is:

```text
collection_learning_paths
learning_path_lessons
learning_path_exercises

user_learning_path_progress
user_learning_path_lesson_progress
user_learning_path_exercise_progress
```

The actual first migration must use the next available migration number at implementation time. Never assume the currently next number if `main` advances.

### Relational vs JSON rule

Persist as relational columns when the value is stable, queried, indexed, or part of identity/order/state:

- path identity
- collection identity
- lesson identity
- exercise identity
- position
- exercise type
- required flag
- status/content state
- schema/content version
- learner progress timestamps/state

Use JSON only for exercise-type-specific configuration that genuinely has variable shape.

Do not store general course structure as a giant opaque JSON document.

## 17. Identity, versioning, publication, and retirement

Stable public IDs are mandatory. The durable decision and evidence are recorded
in [Vocora URL Identity and Resource Naming Convention](../okf/project/vocora-url-identity-and-resource-naming.md).

### Identity

The internal relational key, source-owned content ID, and public route ID are
separate concepts. Existing internal `BIGINT` keys and source IDs remain
authoritative for joins and file synchronization. Database-generated numeric
route IDs are exposed to browsers and API consumers as decimal strings.

Canonical routes use plural resource collections without redundant type
prefixes:

```text
/learning-paths/1
/learning-paths/1/lessons/5/exercises/10
```

Once assigned, a path, lesson, or exercise route ID never changes and is never
recycled. A title, display-name, ordering, or content-version change does not
change the route. Legacy slug routes may resolve and redirect during migration,
but responses and newly generated links use the canonical numeric identity.

### Ordering

Ordering is explicit. Position changes are content changes; they do not change identity by themselves.

### Exercise schema versions

Each exercise definition has `schemaVersion`. A renderer/validator supports explicit versions rather than guessing old payload shapes.

### Course content version

A path stores a synchronized `contentVersion` or equivalent version/hash. Synchronization must be idempotent.

### Removal

Published lessons/exercises with learner history should normally be retired/archived rather than hard-deleted. Historical progress remains explainable.

### Existing learner progress

Content synchronization must never reset or silently rewrite valid learner progress merely because source content was reloaded.

## 18. Vocabulary semantics

Vocabulary identity and Leitner progress remain global to the learner, not duplicated by Learning Path.

If a lesson contains vocabulary whose current states are mixed:

```text
new       -> may be activated into Box 1 by vocabulary.intake
learning  -> preserve existing box/progress
mastered  -> preserve mastered state
excluded  -> preserve exclusion
```

A lesson appearing in another collection must never demote a vocabulary item to Box 1 just because the item is referenced again.

### Scoped practice

A Learning Path vocabulary exercise selects from the intersection of its configured lesson/source scope and the learner's existing vocabulary state.

Example:

```text
12 vocabulary items belong to this lesson
7 are currently eligible for the configured Box 1 practice
=> practise those 7, not the learner's entire Box 1
```

A reusable scope resolver should eventually support scopes such as:

- `collection`
- `collection-section`
- `listening-episode`
- explicit vocabulary IDs

The exact first set is implemented incrementally.

## 19. Listening semantics

`listening.ielts` is an adapter to the existing Listening domain.

It references an existing lesson/test identity and reuses:

- audio ownership;
- attempt creation;
- question presentation contracts;
- server-side grading;
- submitted attempt persistence;
- answer-key protection.

Learning Path completion for this type is backed by a submitted attempt matching the configured exercise.

Test count is data-driven. Never hard-code that every episode contains exactly three, five, or any other fixed number of tests.

## 20. Shadowing semantics

`speaking.shadowing` is an adapter to the existing Shadowing domain.

It must reuse current recording/session/assessment infrastructure and retain the standalone Shadowing route/use case.

Learning Path must not become a dependency of the Shadowing domain.

## 21. BBC 6 Minute English mapping

BBC 6 Minute English is the first production Learning Path and is a **rolling** course.

One existing listening episode becomes one Learning Path lesson.

The existing episode-level vocabulary collection/reference remains authoritative. Do not copy episode vocabulary into a new per-course vocabulary system.

Conceptually:

```text
BBC 6 Minute English course collection
└── Learning Path (rolling)
    ├── Lesson -> existing BBC episode A
    │   ├── vocabulary exercises -> episode vocabulary scope
    │   └── listening.ielts -> existing episode test(s)
    ├── Lesson -> existing BBC episode B
    └── ...
```

Each existing IELTS test can produce one ordered `listening.ielts` exercise. If an episode later contains a different number of tests, synchronization reflects the source data without engine changes.

### BBC synchronization

After listening episode source loading/synchronization, a Learning Path synchronizer can idempotently:

- append a new lesson for a new episode;
- append/reference new tests as exercises;
- update safe mutable metadata;
- retire content when an explicit source rule requires retirement;
- leave unchanged content untouched;
- preserve learner progress and stable IDs.

A new BBC episode must not require hand-editing the Learning Path runtime code.

## 22. Generic file-managed courses

After BBC proves the engine, file-managed course definitions can describe finite collections such as Cambridge or American English File.

A future source folder can follow the repository's existing file-managed-content philosophy, for example:

```text
back/data/learning-paths/
```

Definitions should describe ordering and references, not duplicate the full data owned by vocabulary/listening domains.

The database remains the runtime read model after validated synchronization; version-controlled files remain source truth for built-in managed course definitions where applicable.

## 23. API and authorization principles

All learner endpoints are authenticated and user-scoped.

Read models must never expose another learner's progress or hidden answer keys.

Mutating progress must validate that:

- the learner may access the collection/path;
- the lesson/exercise belongs to that path;
- progression prerequisites are satisfied unless an explicit product rule allows otherwise;
- completion evidence belongs to the same authenticated learner;
- evidence matches the configured source/test/session;
- duplicate/retried completion commands are idempotent.

Administrative content synchronization is separated from learner progress commands.

## 24. Concurrency and resilience

Implementation phases must preserve correctness under normal retries and multi-tab use.

Required direction:

- idempotent start/completion commands where possible;
- uniqueness constraints for one learner/exercise progress identity;
- transactional updates when exercise, lesson, and path progress must advance together;
- no duplicate completion caused by double-click/retry;
- refresh/reload derives state from server persistence;
- failed reads keep known valid UI state and expose retry rather than invent completion/locking state;
- optimistic concurrency can be introduced where necessary based on actual write conflicts.

## 25. TDD policy

New deterministic behavior follows red-green-refactor.

Every phase starts with the smallest failing tests that express the behavior before production implementation.

Required layers as applicable:

### Domain tests

Cover:

- ordering;
- duplicate/invalid positions;
- completion rules;
- finite vs rolling status;
- prerequisite/locking derivation;
- stable identity rules;
- exercise schema/type validation.

### Application tests

Cover:

- command/query boundaries;
- authorization decisions;
- evidence validation;
- idempotency;
- resume-point calculation;
- no cross-user state leakage.

### Infrastructure/MySQL tests

Cover:

- migrations;
- unique constraints;
- repository mapping;
- transactions/rollback;
- synchronization idempotency;
- retained progress when content evolves.

### Angular tests

Cover:

- Exercise Registry resolution;
- unknown type handling;
- path/lesson node states;
- resume navigation;
- component outcomes;
- loading/error states;
- accessibility behavior relevant to the component.

### E2E tests

Cover the real user journey and important regressions without replacing lower-level deterministic tests.

Tests must never be weakened, skipped, or deleted merely to make a phase pass.

## 26. SOLID application

The feature uses SOLID as concrete design constraints, not labels:

- **Single Responsibility:** path orchestration, exercise behavior, persistence, HTTP translation, and rendering remain separate.
- **Open/Closed:** new exercise types extend the Registry/adapters without rewriting the path engine.
- **Liskov:** every registered exercise implementation honors the shared runtime contract.
- **Interface Segregation:** focused ports/services instead of one broad Learning Path service with unrelated responsibilities.
- **Dependency Inversion:** application/domain depend on repository/evidence ports, not MySQL/Express implementations.

Prefer composition over deep inheritance hierarchies.

## 27. Branch and pull-request strategy

`learning-path` is the long-lived integration branch for this project.

Phase 0 creates:

```text
main
  -> learning-path
  -> Draft PR: learning-path -> main
```

All subsequent implementation branches are created from the latest `learning-path` branch and open PRs **into `learning-path`**, not directly into `main`.

Because Git cannot simultaneously use `learning-path` as a ref and as the prefix directory for refs such as `learning-path/foo`, child branches use names such as:

```text
lp-01-learning-path-domain
lp-02-learning-path-persistence
lp-03-learning-path-api
...
```

Before a child PR is merged:

1. update the child branch from current `learning-path` when needed;
2. run phase-specific tests;
3. run affected repository-level checks;
4. keep the PR focused on one phase.

The integration PR remains draft until all planned phases are merged and final release gates pass.

Before final integration:

1. bring the latest `main` into `learning-path`;
2. resolve conflicts on `learning-path`;
3. run the full affected backend, Angular, MySQL, browser/E2E, and Docker smoke checks;
4. mark the integration PR ready only after the complete feature is coherent.

Do not merge the integration PR to `main` automatically unless explicitly requested.

## 28. Planned implementation phases

Architecture is implemented incrementally through child PRs targeting `learning-path`.

1. **Core Domain** — pure Learning Path/Lesson/Exercise/progress rules and tests.
2. **Persistence** — additive migrations, repositories, transactions, indexes, isolation tests.
3. **Backend CQRS/API** — module composition, commands, queries, HTTP adapter.
4. **Angular Learning Path Shell** — path UI, lesson/exercise nodes, full-screen runner shell.
5. **Exercise Runtime** — Registry, host, common context/outcome contract, unsupported-type behavior.
6. **Vocabulary Intake** — scoped activation that preserves existing learner vocabulary state.
7. **Scoped Vocabulary Practice** — practice restricted to current lesson/source scope.
8. **Mastery Revalidation** — collection/lesson-scoped checks for previously mastered vocabulary.
9. **IELTS Listening Adapter** — reuse existing listening attempt/grading behavior.
10. **Shadowing Adapter** — reuse existing Shadowing behavior.
11. **BBC Course Source** — rolling BBC course and idempotent episode/test synchronization.
12. **BBC Full Journey** — library entry, start/resume, lesson progression, up-to-date behavior.
13. **Generic File-managed Paths** — prove a non-BBC finite course without engine redesign.
14. **Hardening** — retries, concurrent tabs, PWA/mobile/accessibility/performance/retirement cases.
15. **Release Gate** — full cross-domain E2E and regression verification.

A phase may be split into smaller PRs if implementation evidence shows the PR would otherwise be too broad; it must not be collapsed into an unreviewable monolithic change.

## 29. Deferred product decisions

The architecture intentionally does not lock choices that can be decided after the engine exists:

- exact visual design of each lesson node;
- exact number and UX of rapid vocabulary drill variants;
- scoring thresholds for future mastery revalidation;
- whether every future exercise permits retakes and how attempts are summarized;
- whether optional exercises contribute to future gamification;
- future branching/prerequisite graphs;
- future teacher/admin authoring UI.

These decisions may extend exercise/config policies without violating the locked boundaries above.

## 30. Architectural invariants

The following rules are hard gates for implementation PRs:

1. Collection Learning Path is separate from the Home daily timeline.
2. Learning Path orchestrates existing domains; it does not duplicate them.
3. Shared vocabulary identity/progress remains shared globally per learner.
4. Lessons and exercises use stable public IDs.
5. Course structure is relational; variable exercise config may use versioned JSON.
6. New backend reads/writes follow CQRS separation.
7. Domain/Application remain framework- and persistence-neutral.
8. Express is an adapter; migration readiness for NestJS is achieved through clean boundaries, not premature Nest code.
9. Angular remains standalone; Learning Path is a logical feature module, not a forced `NgModule`.
10. Learning Path Angular components use separate TypeScript, HTML, SCSS, and spec files.
11. Exercise types are registry-driven and extensible.
12. The server is authoritative for progress and completion.
13. Evidence-backed exercise completion cannot be forged by a bare client boolean.
14. Existing learner history/progress is preserved through content synchronization and migrations.
15. Built-in source synchronization is deterministic and idempotent.
16. TDD is mandatory for new deterministic behavior.
17. No child Learning Path PR targets `main`; child PRs target `learning-path`.

## 31. Definition of Done for each implementation PR

A Learning Path child PR is done only when all applicable items are true:

- behavior was driven by focused tests;
- Domain/Application boundaries remain clean;
- CQRS ownership is explicit for new reads/writes;
- no SQL exists in Domain/Application;
- no Express request/response coupling exists in Domain/Application;
- persistence is behind ports/adapters;
- no duplicate Leitner/Listening/Shadowing implementation was introduced;
- public IDs and existing learner progress are preserved;
- Angular components use separate `.ts`, `.html`, `.scss`, and `.spec.ts` files;
- Angular code follows standalone/OnPush/accessibility conventions;
- focused tests pass;
- affected backend/UI repository-level tests pass;
- relevant MySQL/browser/E2E checks pass when the phase touches those boundaries;
- no unrelated test is disabled, skipped, weakened, or deleted;
- migrations are additive and previously executed migrations are not edited;
- PR base is `learning-path` for every post-Phase-0 child PR;
- documentation is updated if the phase changes a locked public contract intentionally.

## 32. Phase 0 acceptance criteria

Phase 0 is complete when:

- `learning-path` exists from the current `main`;
- this architecture contract is committed on `learning-path`;
- the long-lived `learning-path -> main` PR exists as a Draft;
- the PR records that later feature PRs target `learning-path`;
- implementation has not started prematurely in the architecture-lock change;
- the locked decisions and intentionally deferred product decisions are explicit.

No database schema, runtime API, Angular Learning Path component, or production behavior is introduced in Phase 0.
