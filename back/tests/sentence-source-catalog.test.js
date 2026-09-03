import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSentenceCorpus,
  parseSentenceSource,
} from "../src/domain/sentence-practice/SentenceCorpus.js";
import {
  SENTENCE_SOURCE_DEFINITIONS,
  loadSentenceSources,
} from "../src/infrastructure/sentence-practice/SentenceSourceCatalog.js";

describe("Sentence source catalog", () => {
  it("keeps all four vocabulary sources available for provenance and coverage checks", async () => {
    const sources = await loadSentenceSources();
    assert.equal(sources.length, 4);
    assert.deepEqual(
      sources.map(({ key, expectedSourceItems }) => [key, expectedSourceItems]),
      [
        ["ielts-listening-core-1500", 1_500],
        ["cambridge-vocabulary-for-ielts", 1_177],
        ["american-english-file-3-core-vocabulary", 542],
        ["cambridge-vocabulary-for-ielts-advanced", 547],
      ]
    );

    for (const source of sources) {
      const items = parseSentenceSource(source.sourceText);
      assert.equal(items.length, source.expectedSourceItems, source.key);
    }
  });

  it("does not allow generic sentence generation for imported vocabulary books", async () => {
    const sources = await loadSentenceSources();
    const imported = sources.filter((source) => source.key !== "ielts-listening-core-1500");
    for (const source of imported) {
      assert.throws(
        () => buildSentenceCorpus(source.sourceText),
        /Generic sentence generation for imported vocabulary books is disabled/u,
        source.key
      );
    }
  });

  it("keeps the original IELTS listening generator available for its curated legacy contexts", async () => {
    const sources = await loadSentenceSources();
    const ielts = sources.find((source) => source.key === "ielts-listening-core-1500");
    assert.ok(ielts);
    const corpus = buildSentenceCorpus(ielts.sourceText);
    assert.equal(corpus.sourceItemCount, 1_500);
    assert.equal(corpus.sentenceCount, 4_500);
  });

  it("uses encounter order as provenance so AEF sections may restart numbering without orphaning items", async () => {
    const sources = await loadSentenceSources();
    const aef = sources.find((source) => source.key === "american-english-file-3-core-vocabulary");
    assert.ok(aef);
    const items = parseSentenceSource(aef.sourceText);

    assert.equal(items.length, 542);
    assert.deepEqual(items.slice(0, 3).map((item) => item.sourceItemNumber), [1, 2, 3]);
    assert.ok(items.some((item, index) => index > 0 && item.rawSourceNumber === 1));
    assert.equal(items.at(-1).sourceItemNumber, 542);
  });

  it("keeps source definitions immutable and independently versioned", () => {
    assert.equal(Object.isFrozen(SENTENCE_SOURCE_DEFINITIONS), true);
    for (const source of SENTENCE_SOURCE_DEFINITIONS) {
      assert.equal(Object.isFrozen(source), true);
      assert.ok(source.version);
    }
  });
});
