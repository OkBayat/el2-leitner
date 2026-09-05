import assert from "node:assert/strict";
import { it } from "node:test";
import { GetSentencePracticeCards } from "../src/application/sentence-practice/GetSentencePracticeCards.js";

const definition = { id: "d1", text: "Materials for writing.", languageCode: "en", collectionTitle: "Campus" };
function query(definitions) {
  return new GetSentencePracticeCards({
    sentencePracticeRepository: {
      async findWordsForHouse() {
        return ["stationery", "Stationery"].map((acceptedForm) => ({
          wordId: "w1", term: "stationery", acceptedForm, box: 1, mistakes: 0, definitions
        }));
      },
      async findActiveSentences() {
        return [{ id: "s1", text: "The shop sells stationery.", category: "General", sourceItemNumber: null, variantNumber: null }];
      }
    },
    random: () => 0.5
  });
}

it("projects collection definitions once per card without changing accepted spellings or cloze matching", async () => {
  const { cards } = await query([definition]).execute("user-1", 1);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].definitions, [definition]);
  assert.deepEqual(cards[0].accepted, ["stationery", "Stationery"]);
  assert.equal(cards[0].sentences[0].before, "The shop sells ");
  assert.equal(cards[0].sentences[0].after, ".");
});

it("keeps the additive definition contract safe for legacy repository adapters", async () => {
  const { cards } = await query(undefined).execute("user-1", 1);
  assert.deepEqual(cards[0].definitions, []);
});
