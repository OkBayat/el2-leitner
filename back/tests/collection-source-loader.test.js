import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";
import {
  DEFAULT_COLLECTION_SLUG,
  EXAMPLE_COLLECTION_FILE,
  collectionSourceHash,
  loadCollectionSources
} from "../src/infrastructure/content/loadCollectionSources.js";

const source = (definition = "A small book used for writing notes.", example = "I wrote it in my notebook.") => `
# Test Book
## Lesson 1
- notebook / note book
  - definition: ${definition}
  - example: ${example}
`;

const ieltsSource = `
# IELTS Listening Core 1500
## Test Section
- centre / center
  - definition: The middle point or main place of activity.
  - example: The sports centre closes at nine.
`;

test("collection loader always ignores example-collection.md", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vocora-collections-"));
  try {
    await writeFile(join(directory, EXAMPLE_COLLECTION_FILE), source(), "utf8");
    await writeFile(join(directory, "test-book.md"), source(), "utf8");

    const sources = await loadCollectionSources(directory, new VocabularyFileParser());
    assert.equal(sources.length, 1);
    assert.equal(sources[0].fileName, "test-book.md");
    assert.equal(sources[0].slug, "test-book");
    assert.equal(sources[0].publicId, "test-book");
    assert.equal(sources[0].kind, "book");
    assert.equal(sources[0].isDefault, false);
    assert.equal(sources[0].sourceItemCount, 1);
    assert.equal(sources[0].duplicateAliasCount, 0);
    assert.equal(sources[0].parsed.title, "Test Book");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("IELTS managed source keeps its stable public identity, exam kind, and legacy catalog accounting", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vocora-collections-"));
  try {
    await writeFile(join(directory, `${DEFAULT_COLLECTION_SLUG}.md`), ieltsSource, "utf8");

    const [sourceRecord] = await loadCollectionSources(directory, new VocabularyFileParser());
    assert.equal(sourceRecord.slug, DEFAULT_COLLECTION_SLUG);
    assert.equal(sourceRecord.publicId, DEFAULT_COLLECTION_SLUG);
    assert.equal(sourceRecord.kind, "exam");
    assert.equal(sourceRecord.isDefault, true);
    assert.equal(sourceRecord.sourceItemCount, 1500);
    assert.equal(sourceRecord.duplicateAliasCount, 9);
    assert.equal(sourceRecord.parsed.entries.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("committed IELTS managed source parses to 1,491 canonical entries with one definition and example each", async () => {
  const file = new URL("../data/collections/ielts-listening-core-1500.md", import.meta.url);
  const text = await readFile(file, "utf8");
  const parsed = new VocabularyFileParser().parse(text, { requireStructured: true });

  assert.equal(parsed.sections.length, 44);
  assert.equal(parsed.entries.length, 1491);
  assert.equal(parsed.entries.every((entry) => entry.definitions.length >= 1), true);
  assert.equal(parsed.entries.every((entry) => entry.examples.length >= 1), true);
});

test("collection source hash includes definitions, examples, vocabulary forms, and lessons", () => {
  const parser = new VocabularyFileParser();
  const base = parser.parse(source());
  const changedDefinition = parser.parse(source("A book where you write short notes."));
  const changedExample = parser.parse(source(undefined, "My notebook is on the desk."));
  const changedVocabulary = parser.parse(source().replace("notebook / note book", "journal"));
  const changedLesson = parser.parse(source().replace("Lesson 1", "Lesson 2"));

  const baseHash = collectionSourceHash(base);
  assert.notEqual(collectionSourceHash(changedDefinition), baseHash);
  assert.notEqual(collectionSourceHash(changedExample), baseHash);
  assert.notEqual(collectionSourceHash(changedVocabulary), baseHash);
  assert.notEqual(collectionSourceHash(changedLesson), baseHash);
  assert.equal(collectionSourceHash(parser.parse(source())), baseHash);
});
