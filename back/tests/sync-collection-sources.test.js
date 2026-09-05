import assert from "node:assert/strict";
import test from "node:test";

import { SyncCollectionSources } from "../src/application/library/SyncCollectionSources.js";

class RecordingCollectionSourceRepository {
  constructor() {
    this.sources = [];
    this.archivedWith = null;
    this.finalized = false;
  }

  async sync(source) {
    this.sources.push(source);
    return {
      changed: source.slug === "changed-book",
      slug: source.slug,
      version: source.slug === "changed-book" ? 2 : 1
    };
  }

  async archiveMissing(activeSlugs) {
    this.archivedWith = [...activeSlugs];
    return {
      archivedCount: 1,
      archivedSlugs: ["removed-book"]
    };
  }

  async finalize() {
    this.finalized = true;
    return {
      orphanSentenceLinksRemoved: 2,
      orphanFormsRemoved: 3
    };
  }
}

test("collection source sync processes files, archives missing sources, and finalizes provenance", async () => {
  const repository = new RecordingCollectionSourceRepository();
  const useCase = new SyncCollectionSources({ collectionSourceRepository: repository });
  const sources = [
    { slug: "unchanged-book" },
    { slug: "changed-book" }
  ];

  const result = await useCase.execute(sources);

  assert.deepEqual(repository.sources, sources);
  assert.deepEqual(repository.archivedWith, ["unchanged-book", "changed-book"]);
  assert.equal(repository.finalized, true);
  assert.equal(result.sourceCount, 2);
  assert.equal(result.changedCount, 1);
  assert.equal(result.archivedCount, 1);
  assert.deepEqual(result.archivedSlugs, ["removed-book"]);
  assert.deepEqual(result.cleanup, {
    orphanSentenceLinksRemoved: 2,
    orphanFormsRemoved: 3
  });
  assert.deepEqual(result.results.map((entry) => entry.slug), ["unchanged-book", "changed-book"]);
});
