# File-managed collection sources

Vocora treats backend Markdown collection files as deploy-time source data. New collection files belong in:

`back/data/collections/`

`example-collection.md` is documentation only and is always ignored by the loader.

## File identity

The file name is the stable collection slug. Use lowercase letters, numbers, and hyphens only, for example:

`american-english-file-3-core-vocabulary.md`

Changing definitions, examples, lessons, vocabulary, accepted forms, order, or the book title changes the canonical source hash. `db:setup` reads every managed file on each deployment and synchronizes only sources whose canonical content changed.

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
- Each `##` heading is a lesson.
- Each top-level `-` line is one vocabulary identity.
- The first form is the source's primary display form; forms after ` / ` are accepted spellings/forms of the same vocabulary identity, not synonyms.
- Every vocabulary item requires at least one `definition:`.
- `example:` is optional. When present, it is added to the global sentence corpus and linked to the vocabulary item.
- Multiple definitions and examples are supported.
- The same vocabulary identity may appear only once inside one collection file. This avoids silently losing lesson-specific content.

## Persistence model

Vocabulary identity remains global in `vocabulary_entries` and `vocabulary_forms`. If another collection uses the same word or accepted form, Vocora reuses the existing vocabulary identity.

Definitions are collection-specific and are stored in `collection_entry_definitions`, linked to the relevant `collection_entries` row. Different books may therefore give different definitions for the same vocabulary identity.

Examples are global. Example text is deduplicated in `sentences` by SHA-256 hash and linked to vocabulary through `sentence_vocabulary_entries`. The same sentence can therefore be associated with several vocabulary items without being copied into each collection.

Removing or changing an example in a collection file does not delete the sentence from the global sentence corpus. The corpus is intentionally additive so examples can be reused by other vocabulary and future practice modes.

## Deployment synchronization

`npm run db:setup` performs the following sequence:

1. Applies numbered database migrations.
2. Keeps the current legacy IELTS numbered source seeded for compatibility until it is migrated to this format.
3. Seeds the curated global sentence corpus.
4. Loads every `.md` file in `back/data/collections/` except `example-collection.md`.
5. Parses each file with the structured collection parser.
6. Compares its canonical content hash with `collections.source_hash`.
7. Creates a missing collection or transactionally synchronizes lessons, vocabulary membership, definitions, and example links when the hash changed.
8. Leaves an unchanged source untouched.

The source hash is based on parsed semantic content, not the raw file bytes, so harmless whitespace changes do not create a new collection version.

## Legacy import compatibility

The existing numbered IELTS source and legacy admin import payloads remain supported temporarily by `LegacyNumberedVocabularyFileParser`. Files placed in `back/data/collections/` are strict and must always use the structured format above.
