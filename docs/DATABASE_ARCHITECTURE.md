# Vocora database architecture

## Goal

Vocora separates **shared learning content** from **per-user learning state**. A word that appears in multiple books is stored once; each collection references that vocabulary identity, while every learner keeps independent Leitner progress.

The design deliberately stays relational for queryable business data and uses JSON only for optional metadata that has no stable relational shape.

## Aggregate boundaries

### Library / catalog

- `collections`: a book, exam list, topic, course, or private personal collection.
- `collection_sections`: hierarchical structure such as `Unit 2 / Lesson A`.
- `vocabulary_entries`: canonical orthographic vocabulary identities.
- `vocabulary_forms`: primary and accepted spellings/forms.
- `collection_entries`: ordered many-to-many membership between collections and vocabulary.

A vocabulary entry can belong to many collections. A collection can contain many vocabulary entries. Section/category is membership data, not a property of the global vocabulary identity.

### Learning

- `user_collections`: which collections a learner has activated.
- `user_vocabulary_progress`: current Leitner projection for a learner and vocabulary identity.
- `review_events`: append-only answer history.
- `practice_sessions`: explicit session lifecycle; session boundaries are never inferred from answer events.
- `user_daily_stats`: read-optimized daily aggregate used by existing reports.
- `user_settings`: stable learner preferences.
- `user_state_revisions`: optimistic-concurrency boundary for the compatibility state API.

`learning_states` remains only as the immutable legacy source/backup for users migrated from the old JSON model. New writes do not use it.

## Relationships

```text
collections
  |--< collection_sections
  |--< collection_entries >-- vocabulary_entries --< vocabulary_forms
  |
  `--< user_collections >-- users

users
  |--< user_vocabulary_progress >-- vocabulary_entries
  |--< review_events >------------- vocabulary_entries
  |--< practice_sessions
  |--< user_daily_stats
  |--1 user_settings
  `--1 user_state_revisions
```

## Content identity and duplicates

Vocora currently learns spelling/orthographic items, so a public vocabulary identity is canonicalized by language plus normalized form. Accepted spelling forms are normalized with Unicode NFKC, lowercase English comparison, normalized apostrophes/dashes, and collapsed whitespace.

Examples:

- `Centre` and `centre` normalize to the same form.
- `interest–free  credit` and `interest-free credit` normalize to the same form.
- `centre / center` stores one vocabulary entry with two accepted forms.

Imports also reject duplicate aliases within one file so `centre / center` followed by `center` does not create a second collection item. Import accounting therefore distinguishes **source items** from **unique vocabulary identities**. The built-in IELTS file contains exactly 1,500 numbered source items; after normalization, alias duplicates share one identity. `collections.metadata_json` stores `sourceItemCount`, `uniqueVocabularyCount`, and `duplicateAliasCount`, and database verification checks their consistency.

If Vocora later needs semantic senses for homographs, that is a separate domain requirement and should be modeled explicitly rather than encoded in arbitrary JSON.

## Collection versioning

Every content mutation increments `collections.content_version` exactly once. A membership records `introduced_version` and, when removed, `removed_version` plus `removed_at`.

Subscribed learners keep `last_seen_version`. The compatibility state contains `libraryVersions`, which lets the write adapter distinguish:

- a learner intentionally excluding an item they had already seen, from
- a newly added collection word absent only because the learner's client loaded an older collection version.

Content changes also bump subscribers' `user_state_revisions`. A stale tab therefore receives the existing `409 STATE_CONFLICT` instead of silently overwriting newly published library content.

## Subscription and deletion rules

Deletion is intentionally conservative:

- Removing a word from a collection soft-deletes only `collection_entries` membership.
- Unsubscribing soft-removes only `user_collections` membership.
- The initial default collection is auto-subscribed only when a learner has never made a decision about that default. An existing `removed` row is respected and normal state saves never reactivate it.
- A learner deleting a word sets `user_vocabulary_progress.status = 'excluded'`.
- `vocabulary_entries`, progress, and `review_events` are not destroyed as side effects.

If the same vocabulary is later re-added, the learner's previous progress becomes visible again. If a learner explicitly subscribes to a removed collection again, that explicit command reactivates the subscription.

## Lazy and sparse progress persistence

Subscribing to a 5,000-word collection does **not** create 5,000 progress rows. Missing `user_vocabulary_progress` means the word is unseen (`box = 0`). A row is created when the existing client state first writes progress for that vocabulary or when the learner explicitly excludes it.

The runtime compatibility writer bulk-prefetches collection membership, vocabulary forms, and current progress once per save. It compares the submitted projection with persisted rows and writes only actual progress/settings/daily changes. Untouched catalog vocabulary therefore causes no per-word lookup and no progress write. This keeps storage proportional to actual learning activity and avoids replaying the full catalog on every answer.

## Review events and sessions

`review_events` is append-only. An SHA-256 `event_key` makes compatibility-state retries idempotent, so sending the same historical state again does not duplicate events.

The browser tracks a persistence cursor (`historyLength` plus a content fingerprint of the last persisted event). Each successful save advances that cursor. The normalized writer appends only history after the cursor; if the cursor cannot be validated, the idempotent event key still prevents duplicate rows.

`practice_sessions` is a separate aggregate with explicit `active`, `completed`, and `abandoned` states. The browser starts and completes/abandons a session through dedicated endpoints, while state writes carry `X-Vocora-Session-Id` so new review events can reference the correct session.

## Legacy migration

Migration is additive and recoverable:

1. Numbered SQL migrations create normalized tables without dropping `learning_states`.
2. The built-in IELTS source is seeded as the default public collection; 1,500 numbered source rows are normalized into unique vocabulary identities.
3. Each legacy user's JSON is read transactionally.
4. Words map to shared vocabulary identities; custom words map to a private `واژه‌های من` collection.
5. Leitner fields migrate to `user_vocabulary_progress`.
6. `history` migrates to `review_events`.
7. `daily` migrates to `user_daily_stats`.
8. `settings` migrates to `user_settings`.
9. Unknown root fields are preserved in `user_state_revisions.metadata_json`.
10. Legacy cards that are spelling aliases of the same normalized vocabulary are reconciled once: attempts/correct/mistakes are summed, useful metadata is retained, and scheduling state follows the most recently reviewed representative rather than last-write-wins insertion order.
11. The reconciliation is marked with `legacyAliasProgressMerged` so repeated deploys are idempotent.
12. The original `learning_states` row is left untouched as a rollback/reference copy.

The migration is lazy-safe (`GET/PUT /api/state` migrates one user if needed) and `db:setup` proactively migrates all legacy rows during deployment. The deployment setup then runs alias reconciliation for every migrated legacy row before the application starts.

## Database migrations

`back/database/migrations` is the schema source of truth. `db:setup`:

1. creates `schema_migrations`,
2. applies unapplied migration files in lexical order,
3. stores SHA-256 checksums,
4. refuses to continue if an already-applied migration file has changed,
5. seeds and verifies built-in library content,
6. migrates legacy state,
7. reconciles duplicate legacy alias progress idempotently,
8. verifies key tables.

Applied migration files are immutable. Schema changes require a new numbered migration.

`npm run db:verify` checks critical production invariants with application credentials:

- the built-in IELTS metadata records exactly 1,500 numbered source items,
- the active collection membership count equals `uniqueVocabularyCount`,
- `sourceItemCount - uniqueVocabularyCount` equals `duplicateAliasCount`,
- every legacy `learning_states` row has a normalized `user_state_revisions` projection,
- every legacy row has completed alias-progress reconciliation,
- no duplicate active vocabulary membership exists within a collection.

## CQRS boundary

Library reads use `LibraryQueries`. Library mutations use `LibraryCommands`. Session mutations use `LearningSessionCommands`. Repositories remain infrastructure adapters injected into application services; domain parsing, normalization, collection validation, and authorization policy do not depend on Express or MySQL.

The existing `/api/state` endpoint remains as a compatibility adapter during this incremental refactor. It projects normalized tables back into the legacy browser state shape so the proven Leitner/practice UI does not need a risky all-at-once rewrite.

## Operational invariants

- Public catalog data is stored once, never copied into every learner row.
- A collection item is active at most once per `(collection, vocabulary)` pair.
- User progress is unique per `(user, vocabulary)` pair.
- Unseen shared catalog words require no user progress row.
- Explicit collection unsubscription is never undone by background/default state persistence.
- User state writes are optimistic-concurrency protected.
- Public collection mutations are admin-only; subscriptions are learner actions.
- Review history is append-only and idempotent.
- Database application credentials have only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges.
- JSON is not the source of truth for vocabulary, collection membership, progress, events, sessions, daily aggregates, or settings.

### Reset compatibility without deleting audit history

The legacy UI still sends a full state snapshot when the learner resets progress. The compatibility repository recognizes the clean-reset shape, stores `user_state_revisions.learning_reset_at`, clears materialized daily aggregates, and projects only review events newer than that cutoff. Historical `review_events` stay append-only for auditability while the learner-facing reports reset immediately.
