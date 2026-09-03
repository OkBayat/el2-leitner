import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findSentenceMatch } from "../src/domain/sentence-practice/SentenceMatcher.js";

describe("SentenceMatcher overlapping aliases", () => {
  it("treats a shorter accepted form inside one longer accepted form as one occurrence", () => {
    assert.deepEqual(
      findSentenceMatch("Please enter your full name here.", ["full name", "name"]),
      {
        matchedForm: "full name",
        matchedText: "full name",
        before: "Please enter your ",
        after: " here."
      }
    );
  });

  it("still rejects two genuinely separate target occurrences", () => {
    assert.equal(
      findSentenceMatch("Enter your name and then your full name.", ["full name", "name"]),
      null
    );
  });
});
