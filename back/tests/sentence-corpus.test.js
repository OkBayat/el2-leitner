import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  SENTENCES_PER_SOURCE_ITEM,
  buildSentenceCorpus,
  parseSentenceSource,
  splitSentenceAtAnswer,
} from "../src/domain/sentence-practice/SentenceCorpus.js";

const sourceUrl = new URL("../../ui/data/IELTS_Listening_Core_1500.md", import.meta.url);

describe("Sentence practice corpus", () => {
  it("covers every one of the 1,500 source items with three distinct sentences", async () => {
    const sourceText = await readFile(sourceUrl, "utf8");
    const corpus = buildSentenceCorpus(sourceText);

    assert.equal(corpus.sourceItemCount, 1_500);
    assert.equal(corpus.sentenceCount, 4_500);
    assert.equal(new Set(corpus.records.map((record) => record.sourceItemNumber)).size, 1_500);
    assert.ok(new Set(corpus.records.map((record) => record.category)).size >= 40);

    const sentencesByItem = new Map();
    for (const record of corpus.records) {
      const current = sentencesByItem.get(record.sourceItemNumber) ?? [];
      current.push(record);
      sentencesByItem.set(record.sourceItemNumber, current);

      const split = splitSentenceAtAnswer(record.sentenceText, record.answerText);
      assert.equal(`${split.before}${record.answerText}${split.after}`, record.sentenceText);
      assert.match(record.sentenceText, /[.!?]$/u);
    }

    for (const records of sentencesByItem.values()) {
      assert.equal(records.length, SENTENCES_PER_SOURCE_ITEM);
      assert.equal(new Set(records.map((record) => record.sentenceText)).size, SENTENCES_PER_SOURCE_ITEM);
      assert.deepEqual(records.map((record) => record.variantNumber), [1, 2, 3]);
    }
  });

  it("keeps the curated form-completion examples requested for the first-name card", async () => {
    const sourceText = await readFile(sourceUrl, "utf8");
    const sentences = buildSentenceCorpus(sourceText).records
      .filter((record) => record.answerText === "first name")
      .map((record) => record.sentenceText);

    assert.deepEqual(sentences, [
      "My first name is Mohammad.",
      "What is your first name?",
      "Please enter your first name on the registration form.",
    ]);
  });

  it("preserves accepted spelling variants while using one audible primary answer", async () => {
    const sourceText = await readFile(sourceUrl, "utf8");
    const items = parseSentenceSource(sourceText);
    const colour = items.find((item) => item.acceptedForms.includes("colour"));

    assert.ok(colour);
    assert.equal(colour.answerText, "colour");
    assert.deepEqual(colour.acceptedForms, ["colour", "color"]);
    assert.deepEqual(colour.normalizedForms, ["colour", "color"]);
  });
});
