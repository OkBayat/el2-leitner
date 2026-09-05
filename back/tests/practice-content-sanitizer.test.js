import assert from "node:assert/strict";
import test from "node:test";

import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";
import { LegacyNumberedVocabularyFileParser } from "../src/domain/library/LegacyNumberedVocabularyFileParser.js";
import { parseSentenceSource } from "../src/domain/sentence-practice/SentenceCorpus.js";
import { loadCollectionSources } from "../src/infrastructure/content/loadCollectionSources.js";

const COLLECTIONS_DIRECTORY = new URL("../data/collections/", import.meta.url);

test("managed collection content contains no exclamation marks after parsing", async () => {
  const sources = await loadCollectionSources(COLLECTIONS_DIRECTORY, new VocabularyFileParser());

  for (const source of sources) {
    assert.equal(
      JSON.stringify(source.parsed).includes("!"),
      false,
      `${source.fileName} still exposes an exclamation mark`
    );
  }

  const phrase = sources
    .flatMap((source) => source.parsed.entries)
    .find((entry) => entry.primaryForm === "you can say that again");
  assert.ok(phrase, "Expected the Cambridge phrase without the exclamation mark");
});

test("legacy numbered content strips exclamation marks from sections and vocabulary forms", () => {
  const parsed = new LegacyNumberedVocabularyFileParser().parse(`
## Phrases!
1. amazingly!
`);

  assert.equal(parsed.sections[0].title, "Phrases");
  assert.equal(parsed.entries[0].primaryForm, "amazingly");
  assert.deepEqual(parsed.entries[0].acceptedForms, ["amazingly"]);
});

test("sentence practice strips exclamation marks from source answers", () => {
  const [item] = parseSentenceSource(`
## Phrases!
1. you can say that again!
`);

  assert.equal(item.category, "Phrases");
  assert.equal(item.answerText, "you can say that again");
  assert.deepEqual(item.acceptedForms, ["you can say that again"]);
  assert.deepEqual(item.normalizedForms, ["you can say that again"]);
});
