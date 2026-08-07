import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MySqlLearningStateRepository, isLearningResetCandidate, needsProgressRow, reviewEventKey } from "../src/infrastructure/persistence/mysql/MySqlLearningStateRepository.js";

class ScriptedConnection {
  constructor(results) {
    this.results = [...results];
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
    this.released = false;
  }
  async beginTransaction() {}
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (!this.results.length) throw new Error(`Unexpected SQL: ${sql}`);
    const result = this.results.shift();
    if (result instanceof Error) throw result;
    return result;
  }
  async commit() { this.committed = true; }
  async rollback() { this.rolledBack = true; }
  release() { this.released = true; }
}

class ScriptedPool {
  constructor(connections) {
    this.connections = connections;
  }
  async getConnection() {
    const next = this.connections.shift();
    if (!next) throw new Error("Unexpected connection request");
    return next;
  }
  async execute() {
    throw new Error("Direct pool.execute was not expected in this test");
  }
}

const emptyState = {
  schemaVersion: 2,
  settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" },
  words: [],
  daily: {},
  history: []
};

function migrationAlreadyDone(revision = 3) {
  return new ScriptedConnection([[[{ revision }], []]]);
}

function saveConnection(revisionRows) {
  return new ScriptedConnection([
    [revisionRows, []],
    [[], []],
    [[], []],
    [[], []],
    [[], []],
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []]
  ]);
}

describe("MySqlLearningStateRepository normalized optimistic concurrency", () => {
  it("updates normalized state only when the revision matches", async () => {
    const migration = migrationAlreadyDone(3);
    const save = saveConnection([{ revision: 3 }]);
    const repository = new MySqlLearningStateRepository(new ScriptedPool([migration, save]));

    assert.equal(await repository.save("7", emptyState, 3), 4);
    assert.equal(save.committed, true);
    assert.match(save.calls.at(-1).sql, /UPDATE user_state_revisions/);
    assert.equal(save.calls.at(-1).parameters[0], 4);
  });

  it("rejects a stale revision before writing normalized tables", async () => {
    const migration = migrationAlreadyDone(3);
    const save = new ScriptedConnection([[[{ revision: 3 }], []]]);
    const repository = new MySqlLearningStateRepository(new ScriptedPool([migration, save]));

    await assert.rejects(repository.save("7", emptyState, 2), {
      code: "STATE_CONFLICT",
      statusCode: 409
    });
    assert.equal(save.rolledBack, true);
    assert.equal(save.calls.length, 1);
  });

  it("keeps append-only review history but hides it behind a reset cutoff and clears daily aggregates", async () => {
    const migration = migrationAlreadyDone(3);
    const save = new ScriptedConnection([
      [[{ revision: 3, learning_reset_at: null }], []],
      [[{ id: 99 }], []],
      [{ affectedRows: 1 }, []],
      [[], []],
      [[], []],
      [[], []],
      [{ affectedRows: 1 }, []],
      [{ affectedRows: 1 }, []]
    ]);
    const repository = new MySqlLearningStateRepository(new ScriptedPool([migration, save]));

    assert.equal(await repository.save("7", emptyState, 3), 4);
    assert.match(save.calls[2].sql, /DELETE FROM user_daily_stats/);
    assert.match(save.calls.at(-1).sql, /learning_reset_at/);
    assert.ok(save.calls.at(-1).parameters[2] instanceof Date);
  });

  it("creates revision one for a new normalized state", async () => {
    const migration = new ScriptedConnection([
      [[], []],
      [[], []]
    ]);
    const save = saveConnection([]);
    const repository = new MySqlLearningStateRepository(new ScriptedPool([migration, save]));

    assert.equal(await repository.save("8", emptyState, 0), 1);
    assert.match(save.calls.at(-1).sql, /INSERT INTO user_state_revisions/);
    assert.equal(save.committed, true);
  });
});

describe("normalized progress sparsity", () => {
  it("does not allocate progress rows for untouched shared catalog words", () => {
    assert.equal(needsProgressRow({ box: 0, attempts: 0, category: "Calendar and time" }, {
      catalogCategories: ["Calendar and time"]
    }), false);
  });

  it("stores real learning state, learner overrides, and personal vocabulary", () => {
    assert.equal(needsProgressRow({ box: 1, introducedOn: "2026-08-07" }), true);
    assert.equal(needsProgressRow({ box: 0, notes: "my note" }), true);
    assert.equal(needsProgressRow({ box: 0, category: "My custom category" }, {
      catalogCategories: ["Calendar and time"]
    }), true);
    assert.equal(needsProgressRow({ box: 0 }, { personalMembership: true }), true);
  });
});

class MigrationPool {
  constructor(connection, directResults) {
    this.connection = connection;
    this.directResults = [...directResults];
  }
  async getConnection() { return this.connection; }
  async execute(sql) {
    if (!this.directResults.length) throw new Error(`Unexpected direct SQL: ${sql}`);
    return this.directResults.shift();
  }
}

describe("review event identity", () => {
  it("stays stable when legacy word ids are replaced by normalized vocabulary ids", () => {
    const base = {
      at: "2026-07-12T10:00:00.000Z", day: "2026-07-12", term: "Monday",
      answer: "monday", correct: true, mode: "review", previousBox: 1, newBox: 2, mistakeNumber: null
    };
    assert.equal(
      reviewEventKey("7", { ...base, wordId: "legacy-monday" }),
      reviewEventKey("7", { ...base, wordId: "normalized-public-id" })
    );
  });
});

describe("learning reset compatibility", () => {
  it("recognizes the existing UI reset shape without treating ordinary unseen vocabulary as a reset", () => {
    assert.equal(isLearningResetCandidate({ history: [], words: [
      { term: "Monday", box: 1, attempts: 0, correct: 0, mistakes: 0, introducedOn: "2026-08-07", addedSource: "daily" }
    ] }), true);

    assert.equal(isLearningResetCandidate({ history: [], words: [
      { term: "Monday", box: 2, attempts: 1, correct: 1, mistakes: 0, lastReviewed: "2026-08-07T08:00:00Z" }
    ] }), false);
    assert.equal(isLearningResetCandidate({ history: [{ term: "Monday", correct: true }], words: [] }), false);
  });
});

describe("legacy state migration", () => {
  it("normalizes legacy state once while preserving the legacy row as backup", async () => {
    const legacyState = {
      schemaVersion: 2,
      createdAt: "2026-07-12T10:00:00.000Z",
      words: [], history: [], daily: {},
      settings: { dailyNew: 12, dailyGoal: 30, voiceRate: 0.9, theme: "dark" }
    };
    const connection = new ScriptedConnection([
      [[], []],
      [[{ state_json: JSON.stringify(legacyState), revision: 5, created_at: new Date("2026-07-12T10:00:00.000Z"), updated_at: new Date("2026-07-13T10:00:00.000Z") }], []],
      [[], []],
      [[], []],
      [[], []],
      [[], []],
      [{ affectedRows: 1 }, []],
      [{ affectedRows: 1 }, []]
    ]);
    const pool = new MigrationPool(connection, [[[{ user_id: 7 }], []]]);
    const repository = new MySqlLearningStateRepository(pool);

    assert.equal(await repository.migrateAllLegacyStates(), 1);
    assert.equal(connection.committed, true);
    const revisionInsert = connection.calls.at(-1);
    assert.match(revisionInsert.sql, /INSERT INTO user_state_revisions/);
    assert.equal(revisionInsert.parameters[1], 5);
    assert.equal(connection.calls.some((call) => /DELETE FROM learning_states/u.test(call.sql)), false);
  });
});
