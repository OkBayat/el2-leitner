import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSentenceMatcher, findSentenceMatch } from "../src/domain/sentence-practice/SentenceMatcher.js";

describe("SentenceMatcher", () => {
  it("matches only a complete target and does not confuse name with surname", () => {
    const matchName = createSentenceMatcher(["name"]);

    assert.equal(matchName("Her surname is Sara."), null);
    assert.deepEqual(matchName("Her name is Sara."), {
      matchedForm: "name",
      matchedText: "name",
      before: "Her ",
      after: " is Sara."
    });
  });

  it("supports phrases, hyphens and accepted spelling variants", () => {
    assert.deepEqual(findSentenceMatch("She works part-time while studying.", ["part-time"]), {
      matchedForm: "part-time",
      matchedText: "part-time",
      before: "She works ",
      after: " while studying."
    });

    assert.deepEqual(findSentenceMatch("The color is easy to see.", ["colour", "color"]), {
      matchedForm: "color",
      matchedText: "color",
      before: "The ",
      after: " is easy to see."
    });
  });

  it("keeps capitalized proper terms case-sensitive so May does not match modal may", () => {
    const matchMay = createSentenceMatcher(["May"]);

    assert.equal(matchMay("You may leave after lunch."), null);
    assert.deepEqual(matchMay("The course begins in May."), {
      matchedForm: "May",
      matchedText: "May",
      before: "The course begins in ",
      after: "."
    });
  });

  it("rejects sentences that reveal the target more than once", () => {
    const matchName = createSentenceMatcher(["name"]);

    assert.equal(matchName("Write your name below your name."), null);
  });

  it("finds cash as a complete target even when cashier appears earlier", () => {
    assert.deepEqual(findSentenceMatch("The cashier counted the cash.", ["cash"]), {
      matchedForm: "cash",
      matchedText: "cash",
      before: "The cashier counted the ",
      after: "."
    });
  });
});
