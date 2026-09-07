import assert from "node:assert/strict";
import { test } from "node:test";

import { MySqlLearningPathVocabularyIntakeQueryRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeQueryRepository.js";

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

test("collection-section scope returns only vocabulary entries from the referenced unit", async () => {
  const pool = new RecordingPool([
    [[{ section_id: 55, section_public_id: "section-unit-01", collection_id: 20, collection_public_id: "cambridge-vocabulary-for-ielts" }], []],
    [[{ collection_entry_id: 31, vocabulary_id: "vocab-1", term: "adolescence", progress_user_id: null, progress_status: null, progress_box: null, progress_introduced_on: null, progress_mastered_at: null }], []],
    [[{ collection_entry_id: 31, definition_text: "the period between childhood and adulthood" }], []],
    [[{ collection_entry_id: 31, sentence_text: "Adolescence is a period of rapid change." }], []],
  ]);
  const repository = new MySqlLearningPathVocabularyIntakeQueryRepository(pool);

  const result = await repository.findForScope("user-7", { kind: "collection-section", ref: "section-unit-01" });

  assert.equal(result.collectionId, "cambridge-vocabulary-for-ielts");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].vocabularyId, "vocab-1");
  assert.match(pool.calls[1].sql, /ce\.section_id = \?/u);
  assert.match(pool.calls[2].sql, /ce\.section_id = \?/u);
  assert.match(pool.calls[3].sql, /ce\.section_id = \?/u);
  assert.deepEqual(pool.calls[0].parameters, ["section-unit-01"]);
  assert.deepEqual(pool.calls[1].parameters, ["user-7", 20, 55]);
  assert.deepEqual(pool.calls[2].parameters, [20, 55]);
  assert.deepEqual(pool.calls[3].parameters, [20, 55]);
});
