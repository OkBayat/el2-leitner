import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ExcludeVocabulary } from "../src/application/learning/ExcludeVocabulary.js";

describe("ExcludeVocabulary", () => {
  it("forwards one learner-owned exclusion with the expected revision", async () => {
    const calls = [];
    const useCase = new ExcludeVocabulary({
      vocabularyActivationRepository: {
        async exclude(userId, command) {
          calls.push({ userId, command });
          return 9;
        }
      }
    });

    const result = await useCase.execute(7, {
      revision: 8,
      vocabularyId: " vocab-monday "
    });

    assert.deepEqual(result, { revision: 9 });
    assert.deepEqual(calls, [{
      userId: 7,
      command: { expectedRevision: 8, vocabularyId: "vocab-monday" }
    }]);
  });

  it("rejects invalid input before persistence", async () => {
    let called = false;
    const useCase = new ExcludeVocabulary({
      vocabularyActivationRepository: {
        async exclude() { called = true; }
      }
    });

    await assert.rejects(
      () => useCase.execute(7, { revision: -1, vocabularyId: "vocab-1" }),
      /revision/u
    );
    await assert.rejects(
      () => useCase.execute(7, { revision: 0, vocabularyId: " " }),
      /vocabularyId/u
    );
    assert.equal(called, false);
  });
});
