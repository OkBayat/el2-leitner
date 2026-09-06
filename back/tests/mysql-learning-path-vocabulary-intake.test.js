import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LearningPathVocabularyIntakeReader } from "../src/application/collection-learning-path/ports/LearningPathVocabularyIntakeReader.js";
import { LearningPathVocabularyIntakeWriter } from "../src/application/collection-learning-path/ports/LearningPathVocabularyIntakeWriter.js";
import { MySqlVocabularyActivationRepository } from "../src/infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";
import { MySqlLearningPathVocabularyIntakeCommandRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeCommandRepository.js";
import { MySqlLearningPathVocabularyIntakeQueryRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeQueryRepository.js";

class RecordingPool {
  constructor(responses = []) {
    this.responses = [...responses];
    this.calls = [];
  }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    return this.responses.shift() ?? [[], []];
  }
}

class ActivationConnection {
  constructor() {
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
  }
  async beginTransaction() {}
  async commit() { this.committed = true; }
  async rollback() { this.rolledBack = true; }
  release() {}
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (/SELECT revision FROM user_state_revisions[\s\S]*FOR UPDATE/u.test(sql)) {
      return [[{ revision: 10 }], []];
    }
    if (/FROM vocabulary_entries ve[\s\S]*ORDER BY ve\.id/u.test(sql)) {
      return [[
        { vocabulary_entry_id: 1, vocabulary_id: "new-1", progress_user_id: null, progress_status: null, progress_box: null, progress_introduced_on: null, progress_mastered_at: null },
        { vocabulary_entry_id: 2, vocabulary_id: "learning-1", progress_user_id: 7, progress_status: "active", progress_box: 3, progress_introduced_on: "2026-09-01", progress_mastered_at: null },
        { vocabulary_entry_id: 3, vocabulary_id: "mastered-1", progress_user_id: 7, progress_status: "active", progress_box: 5, progress_introduced_on: "2026-08-01", progress_mastered_at: "2026-09-02 00:00:00" },
        { vocabulary_entry_id: 4, vocabulary_id: "excluded-1", progress_user_id: 7, progress_status: "excluded", progress_box: 0, progress_introduced_on: null, progress_mastered_at: null },
      ], []];
    }
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO user_daily_stats/u.test(sql)) return [{ affectedRows: 1 }, []];
    if (/UPDATE user_state_revisions SET revision = revision \+ 1/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

class ConnectionPool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

describe("Learning Path vocabulary intake MySQL adapters", () => {
  it("implements segregated read/write ports and resolves listening-episode vocabulary without requiring a second subscription", async () => {
    const pool = new RecordingPool([
      [[{ episode_public_id: "episode-1", collection_id: 20, collection_public_id: "episode-vocab" }], []],
      [[
        { collection_entry_id: 31, vocabulary_id: "vocab-1", term: "resilient", progress_user_id: null, progress_status: null, progress_box: null, progress_introduced_on: null, progress_mastered_at: null },
      ], []],
      [[{ collection_entry_id: 31, definition_text: "able to recover quickly" }], []],
      [[{ collection_entry_id: 31, sentence_text: "The system is resilient." }], []],
    ]);
    const reader = new MySqlLearningPathVocabularyIntakeQueryRepository(pool);
    const writer = new MySqlLearningPathVocabularyIntakeCommandRepository({ activateUnseen: async () => ({ revision: 1, activatedCount: 0 }) });

    assert.ok(reader instanceof LearningPathVocabularyIntakeReader);
    assert.ok(writer instanceof LearningPathVocabularyIntakeWriter);

    const result = await reader.findForScope("user-7", { kind: "listening-episode", ref: "episode-1" });
    assert.equal(result.collectionId, "episode-vocab");
    assert.deepEqual(result.items[0], {
      vocabularyId: "vocab-1",
      term: "resilient",
      definitions: ["able to recover quickly"],
      examples: ["The system is resilient."],
      progress: null,
    });
    assert.doesNotMatch(pool.calls[0].sql, /user_collections/u,
      "course access is already authorized by Learning Path and must not require episode-vocabulary subscription");
    assert.deepEqual(pool.calls[1].parameters, ["user-7", 20]);
  });

  it("serializes scoped activation by learner revision and writes only unseen rows", async () => {
    const connection = new ActivationConnection();
    const repository = new MySqlVocabularyActivationRepository(new ConnectionPool(connection));

    const result = await repository.activateUnseen(7, {
      vocabularyIds: ["new-1", "learning-1", "mastered-1", "excluded-1"],
      day: "2026-09-06",
      source: "learning-path",
    });

    assert.deepEqual(result, { revision: 11, activatedCount: 1 });
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    const progressWrite = connection.calls.find(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql));
    assert.deepEqual(progressWrite.parameters, [7, 1, "2026-09-06", "2026-09-06", "learning-path"]);
    const dailyWrite = connection.calls.find(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql));
    assert.deepEqual(dailyWrite.parameters, [7, "2026-09-06", 1]);
  });
});
