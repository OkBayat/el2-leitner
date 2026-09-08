import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ListAvailableLearningPathCollections } from "../src/application/collection-learning-path/queries/ListAvailableLearningPathCollections.js";

describe("ListAvailableLearningPathCollections", () => {
  it("returns only collections whose Learning Paths are readable by the user", async () => {
    const definitionReader = {
      async listActiveCollectionRoutes() {
        return [
          { collectionId: "bbc-six-minute-english", pathId: "1" },
          { collectionId: "private-course", pathId: "2" },
          { collectionId: "cambridge-vocabulary-for-ielts", pathId: "3" },
        ];
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
      [
        { collectionId: "bbc-six-minute-english", pathId: "1" },
        { collectionId: "cambridge-vocabulary-for-ielts", pathId: "3" },
      ],
    );
  });
});
