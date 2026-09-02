import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetSentencePracticeCards } from "../src/application/sentence-practice/GetSentencePracticeCards.js";

class StubSentencePracticeRepository {
  constructor(rows = []) {
    this.rows = rows;
    this.calls = [];
  }

  async findForHouse(userId, house) {
    this.calls.push({ userId, house });
    return structuredClone(this.rows);
  }
}

const row = (overrides = {}) => ({
  wordId: "word-name",
  term: "name",
  acceptedForm: "name",
  box: 1,
  mistakes: 2,
  sentenceId: "sentence-1",
  sourceItemNumber: 12,
  variantNumber: 1,
  category: "Personal details and form completion",
  sentenceText: "My name is Mohammad.",
  answerText: "name",
  ...overrides,
});

describe("GetSentencePracticeCards", () => {
  it("groups accepted forms and sentence variants without exposing duplicate SQL rows", async () => {
    const repository = new StubSentencePracticeRepository([
      row(),
      row({ acceptedForm: "Name" }),
      row({ sentenceId: "sentence-2", variantNumber: 2, sentenceText: "What is your name?" }),
      row({ sentenceId: "sentence-2", variantNumber: 2, sentenceText: "What is your name?", acceptedForm: "Name" }),
    ]);
    const query = new GetSentencePracticeCards({ sentencePracticeRepository: repository });

    const result = await query.execute("user-1", "1");

    assert.deepEqual(repository.calls, [{ userId: "user-1", house: 1 }]);
    assert.deepEqual(result.practice, { mode: "sentence", house: 1, retryGap: 3 });
    assert.deepEqual(result.summary, { totalWords: 1, totalSentences: 2 });
    assert.deepEqual(result.cards[0].accepted, ["name", "Name"]);
    assert.deepEqual(result.cards[0].sentences.map((sentence) => ({ before: sentence.before, after: sentence.after })), [
      { before: "My ", after: " is Mohammad." },
      { before: "What is your ", after: "?" },
    ]);
  });

  it("returns an empty practice deck when the selected house has no covered words", async () => {
    const query = new GetSentencePracticeCards({
      sentencePracticeRepository: new StubSentencePracticeRepository(),
    });

    const result = await query.execute("user-1", 1);

    assert.equal(result.summary.totalWords, 0);
    assert.equal(result.summary.totalSentences, 0);
    assert.deepEqual(result.cards, []);
  });

  it("rejects a house outside the canonical Leitner range", async () => {
    const query = new GetSentencePracticeCards({
      sentencePracticeRepository: new StubSentencePracticeRepository(),
    });

    await assert.rejects(
      () => query.execute("user-1", 6),
      (error) => error.code === "INVALID_LEITNER_HOUSE"
        && error.message === "Leitner house must be an integer between 1 and 5."
    );
  });
});
