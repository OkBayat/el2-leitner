import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetSentencePracticeCards } from "../src/application/sentence-practice/GetSentencePracticeCards.js";

class Repository {
  async findWordsForHouse() {
    return [{ wordId: "word-name", term: "name", acceptedForm: "name", box: 1, mistakes: 0 }];
  }

  async findActiveSentences() {
    return Array.from({ length: 20 }, (_, index) => ({
      id: `sentence-${index + 1}`,
      sourceItemNumber: index + 1,
      variantNumber: 1,
      category: "Test",
      text: `Example ${index + 1} uses name here.`
    }));
  }
}

describe("Sentence practice random sentence selection", () => {
  it("keeps every matching sentence while randomizing their order", async () => {
    const repository = new Repository();
    const first = await new GetSentencePracticeCards({
      sentencePracticeRepository: repository,
      random: () => 0.999,
    }).execute("user-1", 1);
    const second = await new GetSentencePracticeCards({
      sentencePracticeRepository: repository,
      random: () => 0,
    }).execute("user-1", 1);

    assert.equal(first.cards[0].sentences.length, 20);
    assert.equal(second.cards[0].sentences.length, 20);
    assert.deepEqual(
      new Set(first.cards[0].sentences.map((sentence) => sentence.id)),
      new Set(second.cards[0].sentences.map((sentence) => sentence.id))
    );
    assert.notDeepEqual(
      first.cards[0].sentences.map((sentence) => sentence.id),
      second.cards[0].sentences.map((sentence) => sentence.id)
    );
    assert.notEqual(first.cards[0].sentences[0].id, second.cards[0].sentences[0].id);
  });
});
