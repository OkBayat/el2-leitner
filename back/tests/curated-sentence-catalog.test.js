import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPECTED_CURATED_SENTENCE_COUNT,
  loadCuratedSentenceCatalog,
  validateCuratedSentenceText,
} from "../src/infrastructure/sentence-practice/CuratedSentenceCatalog.js";

describe("curated sentence catalog", () => {
  it("contains the reviewed natural catalog with no duplicate or quoted-target filler", async () => {
    const sentences = await loadCuratedSentenceCatalog();
    assert.equal(sentences.length, EXPECTED_CURATED_SENTENCE_COUNT);
    assert.equal(new Set(sentences).size, sentences.length);
    assert.ok(sentences.includes("Please install the software before the meeting."));
    assert.equal(sentences.some((sentence) => sentence.includes("“install”") || sentence.includes('"install"')), false);
    assert.ok(sentences.includes("It is easy to get into debt if you spend more than you earn."));
    assert.ok(sentences.includes("Many people get into debt when they rely too much on credit cards."));
    assert.ok(sentences.includes("Students can get into debt if they borrow more money than they can repay."));
  });

  it("rejects quoted lexical labels and metalinguistic practice templates", () => {
    assert.throws(
      () => validateCuratedSentenceText("The notes included another example with “install”."),
      /quoted label/u
    );
    assert.throws(
      () => validateCuratedSentenceText("The lesson returned to get into debt during the discussion."),
      /metalinguistic\/generic/u
    );
  });
});
