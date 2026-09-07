import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ListAvailableLearningPathCollections } from "../src/application/collection-learning-path/queries/ListAvailableLearningPathCollections.js";

describe("ListAvailableLearningPathCollections", () => {
  it("returns only collections whose Learning Paths are readable by the user", async () => {
    const definitionReader = {
      async listActiveCollectionPublicIds() {
        return ["bbc-six-minute-english", "private-course", "cambridge-vocabulary-for-ielts"];
      },
    };
    const accessReader = {
      async getForCollection(_userId, collectionId) {
        return { canRead: collectionId !== "private-course", canProgress: false };
      },
    };
    const query = new ListAvailableLearningPathCollections({ definitionReader, accessReader });

    assert.deepEqual(
      await query.execute("user-1"),
      ["bbc-six-minute-english", "cambridge-vocabulary-for-ielts"],
    );
  });
});
