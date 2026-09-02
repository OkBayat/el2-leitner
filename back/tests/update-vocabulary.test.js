import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UpdateVocabulary } from "../src/application/learning/UpdateVocabulary.js";

describe("UpdateVocabulary", () => {
  it("passes one normalized word edit and the expected revision to the repository", async () => {
    const calls = [];
    const repository = {
      async updateVocabulary(userId, word, revision) {
        calls.push({ userId, word, revision });
        return revision + 1;
      }
    };
    const useCase = new UpdateVocabulary({ learningStateRepository: repository });

    const result = await useCase.execute("7", "vocab-1", {
      revision: 12,
      term: " circumstances ",
      acceptedForms: ["circumstances", " circumstance "],
      category: " Discussion ",
      notes: " plural preferred "
    });

    assert.deepEqual(calls, [{
      userId: "7",
      revision: 12,
      word: {
        id: "vocab-1",
        term: "circumstances",
        accepted: ["circumstances", "circumstance"],
        category: "Discussion",
        notes: "plural preferred"
      }
    }]);
    assert.deepEqual(result, {
      revision: 13,
      word: {
        id: "vocab-1",
        term: "circumstances",
        accepted: ["circumstances", "circumstance"],
        category: "Discussion",
        notes: "plural preferred"
      }
    });
  });

  it("rejects an invalid revision before touching persistence", async () => {
    let called = false;
    const useCase = new UpdateVocabulary({
      learningStateRepository: {
        async updateVocabulary() { called = true; }
      }
    });

    await assert.rejects(
      useCase.execute("7", "vocab-1", { revision: -1, term: "word", acceptedForms: [] }),
      { code: "INVALID_REVISION", statusCode: 400 }
    );
    assert.equal(called, false);
  });
});
