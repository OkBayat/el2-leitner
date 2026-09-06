import assert from "node:assert/strict";
import test from "node:test";
import { MySqlLearningSettingsRepository } from "../src/infrastructure/persistence/mysql/MySqlLearningSettingsRepository.js";

test("settings repository updates only user_settings and the optimistic revision", async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => statements.push("BEGIN"),
    execute: async (sql, values) => {
      statements.push({ sql: String(sql).replace(/\s+/gu, " ").trim(), values });
      if (String(sql).includes("SELECT revision FROM user_state_revisions")) return [[{ revision: 9 }]];
      return [{}];
    },
    commit: async () => statements.push("COMMIT"),
    rollback: async () => statements.push("ROLLBACK"),
    release: () => statements.push("RELEASE"),
  };
  const repository = new MySqlLearningSettingsRepository({
    getConnection: async () => connection,
  });
  const settings = {
    dailyNew: 10,
    dailyGoal: 20,
    dailyListeningGoal: 4,
    voiceRate: 0.85,
    theme: "light",
  };

  const revision = await repository.update("user-1", settings, 9);

  assert.equal(revision, 10);
  const sql = statements
    .filter((entry) => typeof entry === "object")
    .map((entry) => entry.sql)
    .join("\n");
  assert.match(sql, /INSERT INTO user_settings/u);
  assert.match(sql, /UPDATE user_state_revisions/u);
  assert.doesNotMatch(sql, /vocabulary_entries|review_events|user_daily_stats|learning state/iu);
  assert.deepEqual(statements.slice(-2), ["COMMIT", "RELEASE"]);
});
