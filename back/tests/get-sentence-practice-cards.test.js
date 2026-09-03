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

  async findCandidateSentences(acceptedForms, languageCode, limit) {
    this.calls.push({ method: "candidates", acceptedForms: [...acceptedForms], languageCode, limit });
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
  sourceItemNumber: 123,
  variantNumber: 1,
  category: "Tatoeba",
  text: "Her name is Sara.",
  audioId: "456",
  audioUrl: "https://tatoeba.org/audio/download/456",
  audioContributor: "speaker",
  audioLicense: "CC BY 4.0",
  audioAttributionUrl: "https://example.test/speaker",
  ...overrides
});

describe("GetSentencePracticeCards", () => {
  it("discovers independent audio sentences by regex without scanning the full catalog", async () => {
    const repository = new StubSentencePracticeRepository({
      words: [word(), word({ acceptedForm: "Name" })],
      sentences: [
        sentence({ id: "surname", text: "Her surname is Sara." }),
        sentence({ id: "tatoeba-name-1", sourceItemNumber: 12, text: "Her name is Sara." }),
        sentence({ id: "tatoeba-name-2", sourceItemNumber: 13, audioId: "457", audioUrl: "https://tatoeba.org/audio/download/457", text: "My name is Mohammad." })
      ]
    });
    const query = new GetSentencePracticeCards({
      sentencePracticeRepository: repository,
      random: () => 0.999
    });

    const result = await query.execute("user-1", "1");

    assert.deepEqual(repository.calls, [
      { method: "words", userId: "user-1", house: 1 },
      { method: "candidates", acceptedForms: ["name", "Name"], languageCode: "en", limit: 48 }
    ]);
    assert.deepEqual(result.practice, { mode: "sentence", house: 1, retryGap: 3 });
    assert.deepEqual(result.summary, { totalWords: 1, totalSentences: 2 });
    assert.deepEqual(result.cards[0].accepted, ["name", "Name"]);
    assert.deepEqual(result.cards[0].sentences.map(({ id, before, after, audioUrl }) => ({ id, before, after, audioUrl })), [
      { id: "tatoeba-name-1", before: "Her ", after: " is Sara.", audioUrl: "https://tatoeba.org/audio/download/456" },
      { id: "tatoeba-name-2", before: "My ", after: " is Mohammad.", audioUrl: "https://tatoeba.org/audio/download/457" }
    ]);
  });

  it("passes audio metadata through to the UI deck", async () => {
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
    assert.equal(result.cards[0].sentences[0].audioId, "456");
    assert.equal(result.cards[0].sentences[0].audioUrl, "https://tatoeba.org/audio/download/456");
    assert.equal(result.cards[0].sentences[0].audioLicense, "CC BY 4.0");
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
    assert.equal(result.cards[0].sentences[0].text, "The color is easy to see.");
    assert.equal(result.cards[0].sentences[0].before, "The ");
    assert.equal(result.cards[0].sentences[0].after, " is easy to see.");
  });

  it("does not query sentence candidates when the selected house has no active words", async () => {
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
