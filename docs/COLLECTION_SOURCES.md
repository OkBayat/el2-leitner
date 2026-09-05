# File-managed collection sources

Vocora treats backend Markdown collection files as deploy-time source data. New collection files belong in:

`back/data/collections/`

`example-collection.md` is documentation only and is always ignored by the loader.

## File identity

The file name is the stable collection slug and, for newly created managed collections, the stable public id. Use lowercase letters, numbers, and hyphens only, for example:

`american-english-file-3-core-vocabulary.md`

Changing definitions, examples, lessons, vocabulary, accepted forms, order, or the book title changes the canonical source hash. `db:setup` reads every managed file on each deployment and synchronizes only sources whose canonical content changed.

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
- `example:` is optional at parser level. When present, it is added to the global sentence corpus and linked to the vocabulary item. Curated Vocora collection files should normally provide one natural example for every vocabulary item.
- Multiple definitions and examples are supported.
- When an example is intended for sentence practice, it should contain exactly one accepted form of its vocabulary item so the current sentence matcher can produce a single blank reliably.
- The same vocabulary identity may appear only once inside one collection file. This avoids silently losing lesson-specific content.

## Persistence model

Vocabulary identity remains global in `vocabulary_entries` and `vocabulary_forms`. If another collection uses the same word or accepted form, Vocora reuses the existing vocabulary identity.

Definitions are collection-specific and are stored in `collection_entry_definitions`, linked to the relevant `collection_entries` row. Different books may therefore give different definitions for the same vocabulary identity.

Examples are global. Example text is deduplicated in `sentences` by SHA-256 hash and linked to vocabulary through `sentence_vocabulary_entries`. The same sentence can therefore be associated with several vocabulary items without being copied into each collection.

Removing or changing an example in a collection file does not delete the sentence from the global sentence corpus. The corpus is intentionally additive so examples can be reused by other vocabulary and future practice modes.

## Deployment synchronization

`npm run db:setup` performs the following sequence:

1. Applies numbered database migrations.
2. Keeps the old numbered IELTS bootstrap available only for backward compatibility on databases that have not yet seen the managed IELTS source; once the managed source marker exists, the legacy seed performs no writes.
3. Seeds the curated global sentence corpus.
4. Loads every `.md` file in `back/data/collections/` except `example-collection.md`, including the managed IELTS and American English File collections.
5. Parses each file with the structured collection parser.
6. Compares its canonical content hash with `collections.source_hash`.
7. Creates a missing collection or transactionally synchronizes lessons/sections, vocabulary membership, accepted forms, definitions, and example links when the hash changed.
8. Leaves an unchanged source untouched.

The source hash is based on parsed semantic content, not the raw file bytes, so harmless whitespace changes do not create a new collection version.

## Legacy import compatibility

Legacy numbered admin import payloads remain temporarily supported by `LegacyNumberedVocabularyFileParser`. The IELTS collection itself is now file-managed through `back/data/collections/ielts-listening-core-1500.md`; after that source has been synchronized, the old special IELTS seed is automatically bypassed. Files placed in `back/data/collections/` are strict and must always use the structured format above.
