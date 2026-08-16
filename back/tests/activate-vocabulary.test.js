import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ActivateVocabulary } from "../src/application/learning/ActivateVocabulary.js";

describe("ActivateVocabulary", () => {
  it("forwards one normalized activation to its repository", async () => {
    const calls = [];
    const useCase = new ActivateVocabulary({
      vocabularyActivationRepository: {
        async activate(userId, command) {
          calls.push({ userId, command });
          return 9;
        }
      }
    });

    const result = await useCase.execute(7, {
      revision: 8,
      vocabularyId: " vocab-monday ",
      day: "2026-08-16"
    });

    assert.deepEqual(result, { revision: 9 });
    assert.deepEqual(calls, [{
      userId: 7,
      command: {
        expectedRevision: 8,
        vocabularyId: "vocab-monday",
        day: "2026-08-16"
      }
    }]);
  });

  it("rejects invalid revisions and dates before persistence", async () => {
    let called = false;
    const useCase = new ActivateVocabulary({
      vocabularyActivationRepository: {
        async activate() {
          called = true;
          return 1;
        }
      }
    });

    await assert.rejects(
      () => useCase.execute(7, { revision: -1, vocabularyId: "vocab-1", day: "2026-08-16" }),
      /revision/u
    );
    await assert.rejects(
      () => useCase.execute(7, { revision: 0, vocabularyId: "vocab-1", day: "16-08-2026" }),
      /day/u
    );
    assert.equal(called, false);
  });
});
