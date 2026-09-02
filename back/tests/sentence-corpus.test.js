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

function sentencesFor(corpus, sourceItemNumber) {
  return corpus.records
    .filter((record) => record.sourceItemNumber === sourceItemNumber)
    .map((record) => record.sentenceText);
}

describe("Sentence practice corpus", () => {
  it("covers every one of the 1,500 source items with three distinct natural sentences", async () => {
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
      assert.match(record.sentenceText, /^\p{Lu}/u);
      assert.match(record.sentenceText, /[.!?]$/u);
      assert.doesNotMatch(
        record.sentenceText,
        /missing expression|exact answer|required in this blank|type .* after listening|listen once more and enter|empty space/iu
      );
      assert.equal(record.sentenceText.includes(`“${record.answerText}”`), false);
      assert.equal(record.sentenceText.includes(`"${record.answerText}"`), false);
      assert.equal(record.sentenceText.includes(`'${record.answerText}'`), false);
    }

    for (const records of sentencesByItem.values()) {
      assert.equal(records.length, SENTENCES_PER_SOURCE_ITEM);
      assert.equal(new Set(records.map((record) => record.sentenceText)).size, SENTENCES_PER_SOURCE_ITEM);
      assert.deepEqual(records.map((record) => record.variantNumber), [1, 2, 3]);
    }
  });

  it("uses contextual grammar for representative nouns, verbs, directions, forms and spelling traps", async () => {
    const sourceText = await readFile(sourceUrl, "utf8");
    const corpus = buildSentenceCorpus(sourceText);

    assert.deepEqual(sentencesFor(corpus, 1), [
      "The class is scheduled for Monday.",
      "We usually meet on Monday.",
      "Monday works best for the appointment.",
    ]);
    assert.deepEqual(sentencesFor(corpus, 53), [
      "Please pay in cash.",
      "I withdrew some cash from the bank.",
      "The clerk counted the cash carefully.",
    ]);
    assert.deepEqual(sentencesFor(corpus, 450), [
      "A whale is a cetacean.",
      "The researcher identified the animal as a cetacean.",
      "Every cetacean must surface to breathe.",
    ]);
    assert.deepEqual(sentencesFor(corpus, 1039), [
      "Please turn left at the traffic lights.",
      "You should turn right after the bridge.",
      "You need to turn at the next corner.",
    ]);
    assert.deepEqual(sentencesFor(corpus, 1467), [
      "Researchers will analyse the survey data.",
      "Students learn to analyse complex results.",
      "We need to analyse the evidence carefully.",
    ]);
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

  it("splits only a complete target term and ignores the same letters inside another word", () => {
    assert.deepEqual(splitSentenceAtAnswer("The cashier counted the cash.", "cash"), {
      before: "The cashier counted the ",
      after: ".",
    });
  });
});
