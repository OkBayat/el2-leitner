import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetSentencePracticeCards } from "../src/application/sentence-practice/GetSentencePracticeCards.js";

class StubSentencePracticeRepository {
  constructor({ words = [], sentences = [] } = {}) {
    this.words = words;
    this.sentences = sentences;
    this.calls = [];
  }

  async findWordsForHouse(userId, house) {
    this.calls.push({ method: "words", userId, house });
    return structuredClone(this.words);
  }

  async findActiveSentences(languageCode) {
    this.calls.push({ method: "sentences", languageCode });
    return structuredClone(this.sentences);
  }
}

const word = (overrides = {}) => ({
  wordId: "word-name",
  term: "name",
  acceptedForm: "name",
  box: 1,
  mistakes: 2,
  ...overrides
});

const sentence = (overrides = {}) => ({
  id: "sentence-1",
  sourceItemNumber: null,
  variantNumber: null,
  category: "Manual",
  text: "Her name is Sara.",
  ...overrides
});

describe("GetSentencePracticeCards", () => {
  it("discovers independent sentences by regex instead of a stored vocabulary relation", async () => {
    const repository = new StubSentencePracticeRepository({
      words: [word(), word({ acceptedForm: "Name" })],
      sentences: [
        sentence({ id: "surname", text: "Her surname is Sara." }),
        sentence({ id: "manual-name", text: "Her name is Sara." }),
        sentence({ id: "seed-name", sourceItemNumber: 12, variantNumber: 1, text: "My name is Mohammad." })
      ]
    });
    const query = new GetSentencePracticeCards({
      sentencePracticeRepository: repository,
      random: () => 0.999
    });

    const result = await query.execute("user-1", "1");

    assert.deepEqual(repository.calls, [
      { method: "words", userId: "user-1", house: 1 },
      { method: "sentences", languageCode: "en" }
    ]);
    assert.deepEqual(result.practice, { mode: "sentence", house: 1, retryGap: 3 });
    assert.deepEqual(result.summary, { totalWords: 1, totalSentences: 2 });
    assert.deepEqual(result.cards[0].accepted, ["name", "Name"]);
    assert.deepEqual(result.cards[0].sentences.map(({ id, before, after }) => ({ id, before, after })), [
      { id: "manual-name", before: "Her ", after: " is Sara." },
      { id: "seed-name", before: "My ", after: " is Mohammad." }
    ]);
  });

  it("automatically uses a newly added sentence without any linking row", async () => {
    const repository = new StubSentencePracticeRepository({
      words: [word()],
      sentences: [sentence({ id: "new-row", text: "His name appears on the ticket." })]
    });
    const query = new GetSentencePracticeCards({
      sentencePracticeRepository: repository,
      random: () => 0.999
    });

    const result = await query.execute("user-1", 1);

    assert.equal(result.cards[0].sentences[0].id, "new-row");
    assert.equal(result.cards[0].sentences[0].before, "His ");
    assert.equal(result.cards[0].sentences[0].after, " appears on the ticket.");
  });

  it("matches an accepted alias even when the canonical spelling is not present in the sentence", async () => {
    const repository = new StubSentencePracticeRepository({
      words: [
        word({ wordId: "word-colour", term: "colour", acceptedForm: "colour", mistakes: 0 }),
        word({ wordId: "word-colour", term: "colour", acceptedForm: "color", mistakes: 0 })
      ],
      sentences: [sentence({ id: "color-row", text: "The color is easy to see." })]
    });
    const query = new GetSentencePracticeCards({ sentencePracticeRepository: repository, random: () => 0.999 });

    const result = await query.execute("user-1", 1);

    assert.deepEqual(result.cards[0].accepted, ["colour", "color"]);
    assert.deepEqual(result.cards[0].sentences[0], {
      id: "color-row",
      sourceItemNumber: null,
      variantNumber: null,
      category: "Manual",
      text: "The color is easy to see.",
      before: "The ",
      after: " is easy to see."
    });
  });

  it("keeps definition-only cards when no sentence matches the word", async () => {
    const definition = {
      id: "definition-1",
      text: "A label used to identify a person.",
      languageCode: "en",
      collectionTitle: "People"
    };
    const repository = new StubSentencePracticeRepository({
      words: [word({ definitions: [definition] })],
      sentences: [sentence({ text: "This sentence has no matching term." })]
    });
    const query = new GetSentencePracticeCards({ sentencePracticeRepository: repository });

    const result = await query.execute("user-1", 1);

    assert.deepEqual(result.summary, { totalWords: 1, totalSentences: 0 });
    assert.deepEqual(result.cards, [{
      id: "word-name",
      term: "name",
      accepted: ["name"],
      definitions: [definition],
      box: 1,
      mistakes: 2,
      sentences: []
    }]);
  });

  it("does not scan the sentence catalog when the selected house has no active words", async () => {
    const repository = new StubSentencePracticeRepository();
    const query = new GetSentencePracticeCards({ sentencePracticeRepository: repository });

    const result = await query.execute("user-1", 1);

    assert.deepEqual(result.summary, { totalWords: 0, totalSentences: 0 });
    assert.deepEqual(result.cards, []);
    assert.deepEqual(repository.calls, [{ method: "words", userId: "user-1", house: 1 }]);
  });

  it("rejects a house outside the canonical Leitner range", async () => {
    const query = new GetSentencePracticeCards({
      sentencePracticeRepository: new StubSentencePracticeRepository()
    });

    await assert.rejects(
      () => query.execute("user-1", 6),
      (error) => error.code === "INVALID_LEITNER_HOUSE"
        && error.message === "Leitner house must be an integer between 1 and 5."
    );
  });
});
