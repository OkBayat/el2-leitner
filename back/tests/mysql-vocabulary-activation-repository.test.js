import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlVocabularyActivationRepository } from "../src/infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";

class PatternConnection {
  constructor({ revision = 8, progress = null, targetExists = true } = {}) {
    this.revision = revision;
    this.progress = progress;
    this.targetExists = targetExists;
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
  }

  async beginTransaction() {}
  async commit() { this.committed = true; }
  async rollback() { this.rolledBack = true; }
  release() {}

  targetRow() {
    if (!this.targetExists) return null;
    return {
      vocabulary_entry_id: 30,
      progress_user_id: this.progress ? 7 : null,
      progress_status: this.progress?.status ?? null,
      progress_box: this.progress?.box ?? null,
      progress_due_date: this.progress?.due ?? null,
      progress_introduced_on: this.progress?.introducedOn ?? null,
      progress_introduced_via: this.progress?.introducedVia ?? null
    };
  }

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });

    if (/UPDATE user_state_revisions[\s\S]*WHERE user_id = \? AND revision = \?/u.test(sql)) {
      const expectedRevision = Number(parameters[1]);
      if (this.revision !== expectedRevision) return [{ affectedRows: 0 }, []];
      this.revision += 1;
      return [{ affectedRows: 1 }, []];
    }

    if (/SELECT revision FROM user_state_revisions/u.test(sql)) {
      return [[{ revision: this.revision }], []];
    }

    if (/SELECT ve\.id AS vocabulary_entry_id/u.test(sql)) {
      const target = this.targetRow();
      return [target ? [target] : [], []];
    }

    if (/INSERT INTO user_vocabulary_progress/u.test(sql)) {
      if (!this.targetExists) return [{ affectedRows: 0 }, []];
      if (this.progress && (Number(this.progress.box) > 0 || this.progress.introducedOn)) {
        return [{ affectedRows: 0 }, []];
      }
      return [{ affectedRows: this.progress ? 2 : 1 }, []];
    }

    if (/INSERT INTO user_daily_stats/u.test(sql)) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

class PatternPool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

const command = {
  expectedRevision: 8,
  vocabularyId: "vocab-monday",
  day: "2026-08-16"
};

describe("MySqlVocabularyActivationRepository", () => {
  it("uses the short hot path: revision claim, one progress write and one daily write", async () => {
    const connection = new PatternConnection();
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    const revision = await repository.activate(7, command);

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    assert.equal(connection.calls.length, 3,
      "a successful activation should need only three SQL round trips inside the transaction");
    assert.equal(connection.calls.some(({ sql }) => /FOR UPDATE/u.test(sql)), false,
      "the hot path must not hold the revision lock while performing a separate vocabulary lookup");
    assert.equal(connection.calls.some(({ sql }) => /SELECT revision FROM user_state_revisions/u.test(sql)), false,
      "the optimistic revision claim replaces the old revision SELECT");

    const revisionWrite = connection.calls[0];
    assert.match(revisionWrite.sql, /WHERE user_id = \? AND revision = \?/u);
    assert.deepEqual(revisionWrite.parameters, [7, 8]);

    const progressWrite = connection.calls[1];
    assert.match(progressWrite.sql, /INSERT INTO user_vocabulary_progress/u);
    assert.match(progressWrite.sql, /SELECT \?, ve\.id/u);
    assert.deepEqual(progressWrite.parameters, [7, "2026-08-16", "2026-08-16", 7, 7, "vocab-monday"]);

    const dailyWrite = connection.calls[2];
    assert.match(dailyWrite.sql, /INSERT INTO user_daily_stats/u);
    assert.deepEqual(dailyWrite.parameters, [7, "2026-08-16"]);
  });

  it("activates an unseen word even when a box-zero row exists only for metadata", async () => {
    const connection = new PatternConnection({
      progress: {
        status: "active",
        box: 0,
        due: null,
        introducedOn: null,
        introducedVia: null
      }
    });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    const revision = await repository.activate(7, command);

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.calls.length, 3);
  });

  it("treats the immediately retried identical activation as idempotent without touching daily stats", async () => {
    const connection = new PatternConnection({
      revision: 9,
      progress: {
        status: "active",
        box: 1,
        due: "2026-08-16",
        introducedOn: "2026-08-16",
        introducedVia: "word-bank"
      }
    });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    const revision = await repository.activate(7, command);

    assert.equal(revision, 9);
    assert.equal(connection.committed, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql)), false,
      "an immediate retry must not double-count the daily activation");
  });

  it("rejects a stale revision before mutating progress", async () => {
    const connection = new PatternConnection({ revision: 11 });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    await assert.rejects(() => repository.activate(7, command), /updated by another session/u);
    assert.equal(connection.committed, false);
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_vocabulary_progress/u.test(sql)), false);
  });

  it("rolls back the claimed revision when the selected vocabulary is unavailable", async () => {
    const connection = new PatternConnection({ targetExists: false });
    const repository = new MySqlVocabularyActivationRepository(new PatternPool(connection));

    await assert.rejects(() => repository.activate(7, command), /Vocabulary entry was not found/u);
    assert.equal(connection.committed, false);
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.calls.some(({ sql }) => /INSERT INTO user_daily_stats/u.test(sql)), false);
  });
});
