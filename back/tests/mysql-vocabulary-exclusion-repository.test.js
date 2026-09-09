import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlVocabularyActivationRepository } from "../src/infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";

class ExclusionConnection {
  constructor({ progressWrite = 1, target = null } = {}) {
    this.progressWrite = progressWrite;
    this.target = target;
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
    if (/UPDATE user_state_revisions[\s\S]*WHERE user_id = \? AND revision = \?/u.test(sql)) {
      return [{ affectedRows: 1 }, []];
    }
    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) {
      return [{ affectedRows: this.progressWrite }, []];
    }
    if (/SELECT ve\.id AS vocabulary_entry_id/u.test(sql)) {
      return [this.target ? [this.target] : [], []];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

describe("MySqlVocabularyActivationRepository exclusions", () => {
  it("marks only an unintroduced accessible word as excluded in the revision transaction", async () => {
    const connection = new ExclusionConnection();
    const repository = new MySqlVocabularyActivationRepository({
      getConnection: async () => connection
    });

    const revision = await repository.exclude(7, {
      expectedRevision: 8,
      vocabularyId: "vocab-monday"
    });

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    assert.equal(connection.calls.length, 2);
    const progressWrite = connection.calls[1];
    assert.match(progressWrite.sql, /'excluded'/u);
    assert.match(progressWrite.sql, /COALESCE\(existing\.box, 0\) = 0/u);
    assert.match(progressWrite.sql, /existing\.introduced_on IS NULL/u);
    assert.deepEqual(progressWrite.parameters, [7, 7, 7, "vocab-monday"]);
  });

  it("rejects removing a word that is already active in Leitner", async () => {
    const connection = new ExclusionConnection({
      progressWrite: 0,
      target: {
        vocabulary_entry_id: 30,
        progress_user_id: 7,
        progress_status: "active",
        progress_box: 1,
        progress_introduced_on: "2026-09-09"
      }
    });
    const repository = new MySqlVocabularyActivationRepository({
      getConnection: async () => connection
    });

    await assert.rejects(
      () => repository.exclude(7, { expectedRevision: 8, vocabularyId: "vocab-monday" }),
      { code: "VOCABULARY_ALREADY_ACTIVE", statusCode: 409 }
    );
    assert.equal(connection.committed, false);
    assert.equal(connection.rolledBack, true);
  });

  it("does not expose vocabulary outside the learner's active collections", async () => {
    const connection = new ExclusionConnection({ progressWrite: 0 });
    const repository = new MySqlVocabularyActivationRepository({
      getConnection: async () => connection
    });

    await assert.rejects(
      () => repository.exclude(7, { expectedRevision: 8, vocabularyId: "missing" }),
      { code: "VOCABULARY_NOT_FOUND", statusCode: 404 }
    );
    assert.equal(connection.rolledBack, true);
  });
});
