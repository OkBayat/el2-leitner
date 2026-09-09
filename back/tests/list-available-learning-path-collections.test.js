import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ListAvailableLearningPathCollections } from "../src/application/collection-learning-path/queries/ListAvailableLearningPathCollections.js";

describe("ListAvailableLearningPathCollections", () => {
  it("returns the bounded learner-specific course catalog projection", async () => {
    const calls = [];
    const catalogReader = {
      async listAvailableForUser(userId) {
        calls.push(userId);
        return [
          { collectionId: "bbc-six-minute-english", pathId: "1", title: "BBC 6 Minute English", learnerStatus: "in_progress", enrolled: true },
          { collectionId: "cambridge-vocabulary-for-ielts", pathId: "3", title: "Cambridge Vocabulary for IELTS", learnerStatus: "available", enrolled: false },
        ];
      },
    };
    const query = new ListAvailableLearningPathCollections({ catalogReader });

    assert.deepEqual(
      await query.execute("user-1"),
      [
        { collectionId: "bbc-six-minute-english", pathId: "1", title: "BBC 6 Minute English", learnerStatus: "in_progress", enrolled: true },
        { collectionId: "cambridge-vocabulary-for-ielts", pathId: "3", title: "Cambridge Vocabulary for IELTS", learnerStatus: "available", enrolled: false },
      ],
    );
    assert.deepEqual(calls, ["user-1"]);
  });
});
