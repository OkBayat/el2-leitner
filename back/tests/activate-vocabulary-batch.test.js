import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ActivateVocabularyBatch } from "../src/application/learning/ActivateVocabularyBatch.js";

class FakeRepository {
  constructor() { this.calls = []; }
  async activateBatch(userId, command) {
    this.calls.push({ userId, command });
    return command.expectedRevision + 1;
  }
}

describe("ActivateVocabularyBatch", () => {
  it("deduplicates ids and forwards one compact automatic activation batch", async () => {
    const repository = new FakeRepository();
    const useCase = new ActivateVocabularyBatch({ vocabularyActivationRepository: repository });

    const result = await useCase.execute("7", {
      revision: 4949,
      vocabularyIds: ["vocab-1", "vocab-2", "vocab-1"],
      day: "2026-08-16",
      source: "daily"
    });

    assert.deepEqual(result, { revision: 4950 });
    assert.deepEqual(repository.calls, [{
      userId: "7",
      command: {
        expectedRevision: 4949,
        vocabularyIds: ["vocab-1", "vocab-2"],
        day: "2026-08-16",
        source: "daily"
      }
    }]);
  });

  it("rejects invalid sources, empty batches and batches larger than one UI page", async () => {
    const useCase = new ActivateVocabularyBatch({ vocabularyActivationRepository: new FakeRepository() });

    await assert.rejects(() => useCase.execute("7", {
      revision: 1,
      vocabularyIds: ["vocab-1"],
      day: "2026-08-16",
      source: "word-bank"
    }), { code: "INVALID_VOCABULARY_ACTIVATION_BATCH" });

    await assert.rejects(() => useCase.execute("7", {
      revision: 1,
      vocabularyIds: [],
      day: "2026-08-16",
      source: "daily"
    }), { code: "INVALID_VOCABULARY_ACTIVATION_BATCH" });

    await assert.rejects(() => useCase.execute("7", {
      revision: 1,
      vocabularyIds: Array.from({ length: 51 }, (_, index) => `vocab-${index}`),
      day: "2026-08-16",
      source: "home-selection"
    }), { code: "INVALID_VOCABULARY_ACTIVATION_BATCH" });
  });
});
