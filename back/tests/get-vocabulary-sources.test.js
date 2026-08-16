import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetVocabularySources } from "../src/application/library/GetVocabularySources.js";

describe("GetVocabularySources", () => {
  it("requests only the supplied vocabulary ids", async () => {
    const calls = [];
    const useCase = new GetVocabularySources({
      vocabularySourceRepository: {
        async findByVocabularyIds(userId, ids) {
          calls.push({ userId, ids });
          return ids.map((id) => ({ vocabularyId: id, term: id, collections: [] }));
        }
      }
    });

    const result = await useCase.execute(7, { ids: " vocab-1,vocab-2,vocab-1 " });
    assert.deepEqual(calls, [{ userId: 7, ids: ["vocab-1", "vocab-2"] }]);
    assert.equal(result.sources.length, 2);
  });

  it("does not query persistence when no ids were requested", async () => {
    let called = false;
    const useCase = new GetVocabularySources({
      vocabularySourceRepository: {
        async findByVocabularyIds() {
          called = true;
          return [];
        }
      }
    });
    assert.deepEqual(await useCase.execute(7, {}), { sources: [] });
    assert.equal(called, false);
  });

  it("rejects requests larger than one visible page", async () => {
    const useCase = new GetVocabularySources({
      vocabularySourceRepository: { findByVocabularyIds: async () => [] }
    });
    const ids = Array.from({ length: 51 }, (_, index) => `vocab-${index}`);
    await assert.rejects(() => useCase.execute(7, { ids }), /At most 50 vocabulary ids/u);
  });
});
