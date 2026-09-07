import assert from "node:assert/strict";
import { test } from "node:test";

import { LearningPathSourceReferenceReader } from "../src/application/collection-learning-path/ports/LearningPathSourceReferenceReader.js";
import { MySqlLearningPathSourceReferenceQueryRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathSourceReferenceQueryRepository.js";

class RecordingPool {
  constructor(responses) {
    this.responses = [...responses];
    this.calls = [];
  }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    return this.responses.shift() ?? [[], []];
  }
}

test("source reference adapter implements the read port and resolves published collection sections", async () => {
  const pool = new RecordingPool([
    [[{ id: "cambridge-vocabulary-for-ielts", title: "Cambridge Vocabulary for IELTS" }], []],
    [[{ id: "section-unit-01", collectionId: "cambridge-vocabulary-for-ielts", title: "Unit 1 — Growing up" }], []],
  ]);
  const repository = new MySqlLearningPathSourceReferenceQueryRepository(pool);
  assert.ok(repository instanceof LearningPathSourceReferenceReader);

  const collection = await repository.resolveCollection("cambridge-vocabulary-for-ielts");
  const section = await repository.findCollectionSection({
    collectionId: collection.id,
    sectionTitle: "Unit 1 — Growing up",
  });

  assert.equal(collection.id, "cambridge-vocabulary-for-ielts");
  assert.equal(section.id, "section-unit-01");
  assert.deepEqual(pool.calls[0].parameters, ["cambridge-vocabulary-for-ielts", "cambridge-vocabulary-for-ielts"]);
  assert.deepEqual(pool.calls[1].parameters, ["cambridge-vocabulary-for-ielts", "Unit 1 — Growing up"]);
  assert.match(pool.calls[0].sql, /c\.public_id = \? OR c\.slug = \?/u);
  assert.match(pool.calls[0].sql, /status = 'published'/u);
  assert.match(pool.calls[1].sql, /status = 'published'/u);
});

test("source reference adapter resolves a legacy collection public id through the stable managed slug", async () => {
  const pool = new RecordingPool([
    [[{ id: "legacy-random-public-id", title: "Cambridge Vocabulary for IELTS" }], []],
  ]);
  const repository = new MySqlLearningPathSourceReferenceQueryRepository(pool);

  const collection = await repository.resolveCollection("cambridge-vocabulary-for-ielts");

  assert.deepEqual(collection, {
    id: "legacy-random-public-id",
    title: "Cambridge Vocabulary for IELTS",
  });
  assert.deepEqual(pool.calls[0].parameters, ["cambridge-vocabulary-for-ielts", "cambridge-vocabulary-for-ielts"]);
});

test("source reference adapter refuses ambiguous section titles instead of selecting an arbitrary row", async () => {
  const pool = new RecordingPool([
    [[
      { id: "section-a", collectionId: "collection", title: "Unit 1" },
      { id: "section-b", collectionId: "collection", title: "Unit 1" },
    ], []],
  ]);
  const repository = new MySqlLearningPathSourceReferenceQueryRepository(pool);
  await assert.rejects(
    () => repository.findCollectionSection({ collectionId: "collection", sectionTitle: "Unit 1" }),
    /Ambiguous collection section reference/u,
  );
});
