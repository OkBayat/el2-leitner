import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SENTENCES_PER_SOURCE_ITEM,
  buildSentenceCorpus,
  parseSentenceSource,
  splitSentenceAtAnswer,
} from "../src/domain/sentence-practice/SentenceCorpus.js";
import {
  SENTENCE_SOURCE_DEFINITIONS,
  loadSentenceSources,
} from "../src/infrastructure/sentence-practice/SentenceSourceCatalog.js";

describe("Sentence source catalog", () => {
  it("generates three valid sentences for every item in all four vocabulary sources", async () => {
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

    let totalItems = 0;
    let totalSentences = 0;
    for (const source of sources) {
      const corpus = buildSentenceCorpus(source.sourceText);
      assert.equal(corpus.sourceItemCount, source.expectedSourceItems, source.key);
      assert.equal(corpus.sentenceCount, source.expectedSourceItems * SENTENCES_PER_SOURCE_ITEM, source.key);
      const counts = new Map();
      const texts = new Map();
      for (const record of corpus.records) {
        const split = splitSentenceAtAnswer(record.sentenceText, record.answerText);
        assert.equal(`${split.before}${record.answerText}${split.after}`, record.sentenceText);
        assert.match(record.sentenceText, /[.!?]$/u);
        counts.set(record.sourceItemNumber, (counts.get(record.sourceItemNumber) ?? 0) + 1);
        const itemTexts = texts.get(record.sourceItemNumber) ?? new Set();
        itemTexts.add(record.sentenceText);
        texts.set(record.sourceItemNumber, itemTexts);
      }
      assert.equal(counts.size, source.expectedSourceItems);
      for (const count of counts.values()) assert.equal(count, SENTENCES_PER_SOURCE_ITEM);
      for (const itemTexts of texts.values()) assert.equal(itemTexts.size, SENTENCES_PER_SOURCE_ITEM);
      totalItems += corpus.sourceItemCount;
      totalSentences += corpus.sentenceCount;
    }

    assert.equal(totalItems, 3_766);
    assert.equal(totalSentences, 11_298);
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
