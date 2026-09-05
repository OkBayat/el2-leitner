# File-managed collection sources

Vocora treats backend Markdown collection files as deploy-time source data. New collection files belong in:

`back/data/collections/`

`example-collection.md` is documentation only and is always ignored by the loader.

## File identity

The file name is the stable collection slug and, for newly created managed collections, the stable public id. Use lowercase letters, numbers, and hyphens only, for example:

`american-english-file-3-core-vocabulary.md`

Changing definitions, examples, lessons, vocabulary, accepted forms, order, or the book title changes the canonical source hash. `db:setup` reads every managed file on each deployment and synchronizes only sources whose canonical content changed.

The managed source format is currently version 2. Version 2 adds explicit provenance for accepted forms and examples so removals can be reconciled safely across collections that share global vocabulary and sentence identities.

`ielts-listening-core-1500.md` is the default built-in exam collection. It keeps the historical public id `ielts-listening-core-1500`, `exam` kind, and the original 1,500-source-item accounting while storing 1,491 canonical vocabulary identities after nine explicit duplicate aliases are merged.

## Format

```markdown
# Book title

## Lesson 1 — Lesson title

- primary form / accepted form 2 / accepted form 3
  - definition: A short definition written in simple English.
  - example: A natural sentence that uses the vocabulary item.
```

Rules:

- One `#` heading is required for the book title.
- Each `##` heading is a lesson or source section.
- Each top-level `-` line is one vocabulary identity.
- The first form is the source's primary display form; forms after ` / ` are accepted spellings/forms of the same vocabulary identity, not synonyms.
- Every vocabulary item requires at least one `definition:`.
- `example:` is optional at parser level. Curated Vocora collection files should normally provide one natural example for every vocabulary item.
- Multiple definitions and examples are supported.
- When an example is intended for sentence practice, it should contain exactly one accepted form of its vocabulary item so the current sentence matcher can produce a single blank reliably.
- The same vocabulary identity may appear only once inside one collection file. This avoids silently losing lesson-specific content.

## Persistence model

Vocabulary identity remains global in `vocabulary_entries` and `vocabulary_forms`. If another collection uses the same word or accepted form, Vocora reuses the existing vocabulary identity.

`collection_entry_forms` records which accepted forms are actually declared by each managed collection entry. A removed non-primary form is deleted from the global vocabulary form catalog only when no other active managed source references it and no unmanaged collection needs the same vocabulary identity.

Definitions are collection-specific and are stored in `collection_entry_definitions`, linked to the relevant `collection_entries` row. Different books may therefore give different definitions for the same vocabulary identity.

Examples are globally deduplicated in `sentences` by SHA-256 hash. `collection_entry_examples` records which collection entry currently owns each example reference, while `sentence_vocabulary_entries` remains the derived vocabulary-to-sentence link used by sentence features.

The curated independent sentence catalog is marked with `sentences.is_curated`. Removing or changing an example in a collection file removes that collection's provenance immediately. A sentence is made inactive only when it is not part of the curated catalog and no other active managed collection references it. This prevents stale examples from remaining in sentence practice while still allowing safe reuse across books.

## Deployment synchronization

`npm run db:setup` performs the following sequence:

1. Applies numbered database migrations.
2. Keeps the historical IELTS bootstrap available for databases created before the managed IELTS source is first synchronized.
3. Seeds and marks the curated global sentence corpus.
4. Loads every `.md` file in `back/data/collections/` except `example-collection.md`.
5. Parses each file with the strict structured collection parser.
6. Compares its canonical content hash with `collections.source_hash`.
7. Creates a missing collection or transactionally reconciles lessons, vocabulary membership, accepted-form provenance, definitions, and example provenance when the hash changed.
8. Removes stale accepted-form/example references without deleting data still used by another collection or the curated sentence catalog.
9. Archives any previously file-managed collection whose source file no longer exists. Its active entries are retired, its source references are removed, and its `source_hash` is cleared so restoring the file can reactivate it cleanly.
10. Runs a final provenance cleanup so databases that previously synchronized format-version-1 sources lose orphan sentence links and stale non-primary accepted forms.
11. Leaves unchanged current sources untouched.

The source hash is based on parsed semantic content, not the raw file bytes, so harmless whitespace changes do not create a new collection version.

Renaming a managed file is intentionally treated as removing the old collection identity and creating a new one because the file name is the stable slug. The old collection is archived rather than silently reassigned.

## IELTS Listening Core 1500

The historical source contains 1,500 numbered rows. Nine later rows explicitly repeat an existing vocabulary identity as a spelling/plural alias, so the managed collection contains 1,491 canonical entries while retaining the historical `sourceItemCount = 1500` and `duplicateAliasCount = 9` metadata used by existing verification and client code.

All 44 source sections are preserved. Every canonical IELTS entry has at least one short simple-English definition and one natural example sentence. The examples are written so the target accepted form occurs exactly once, making them safe for the current sentence-practice blank matcher.
