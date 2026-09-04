import assert from "node:assert/strict";
import test from "node:test";

import { SyncCollectionSources } from "../src/application/library/SyncCollectionSources.js";

class RecordingCollectionSourceRepository {
  constructor() {
    this.sources = [];
  }

  async sync(source) {
    this.sources.push(source);
    return {
      changed: source.slug === "changed-book",
      slug: source.slug,
      version: source.slug === "changed-book" ? 2 : 1
    };
  }
}

test("collection source sync processes every discovered file and reports only changed sources", async () => {
  const repository = new RecordingCollectionSourceRepository();
  const useCase = new SyncCollectionSources({ collectionSourceRepository: repository });
  const sources = [
    { slug: "unchanged-book" },
    { slug: "changed-book" }
  ];

  const result = await useCase.execute(sources);

  assert.deepEqual(repository.sources, sources);
  assert.equal(result.sourceCount, 2);
  assert.equal(result.changedCount, 1);
  assert.deepEqual(result.results.map((entry) => entry.slug), ["unchanged-book", "changed-book"]);
});
