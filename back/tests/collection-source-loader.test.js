import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";
import {
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

test("collection loader always ignores example-collection.md", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vocora-collections-"));
  try {
    await writeFile(join(directory, EXAMPLE_COLLECTION_FILE), source(), "utf8");
    await writeFile(join(directory, "test-book.md"), source(), "utf8");

    const sources = await loadCollectionSources(directory, new VocabularyFileParser());
    assert.equal(sources.length, 1);
    assert.equal(sources[0].fileName, "test-book.md");
    assert.equal(sources[0].slug, "test-book");
    assert.equal(sources[0].parsed.title, "Test Book");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
