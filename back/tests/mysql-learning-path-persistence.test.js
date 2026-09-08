import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { LearningPathDefinitionReader } from "../src/application/collection-learning-path/ports/LearningPathDefinitionReader.js";
import { LearningPathDefinitionWriter } from "../src/application/collection-learning-path/ports/LearningPathDefinitionWriter.js";
import { LearningPathProgressReader } from "../src/application/collection-learning-path/ports/LearningPathProgressReader.js";
import { LearningPathProgressWriter } from "../src/application/collection-learning-path/ports/LearningPathProgressWriter.js";
import { LearningPathTransactionManager } from "../src/application/collection-learning-path/ports/LearningPathTransactionManager.js";
import { MySqlLearningPathDefinitionCommandRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionCommandRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";
import { MySqlLearningPathProgressCommandRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressCommandRepository.js";
import { MySqlLearningPathProgressQueryRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressQueryRepository.js";
import { MySqlLearningPathTransactionManager } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathTransactionManager.js";

class TransactionConnection {
  constructor({ failCommit = false } = {}) {
    this.events = [];
    this.failCommit = failCommit;
  }
  async beginTransaction() { this.events.push("begin"); }
  async commit() {
    this.events.push("commit");
    if (this.failCommit) throw new Error("commit failed");
  }
  async rollback() { this.events.push("rollback"); }
  release() { this.events.push("release"); }
}

class ConnectionPool {
  constructor(connection) { this.connection = connection; }
  async getConnection() { return this.connection; }
}

class RecordingPool {
  constructor(responses = []) {
    this.responses = [...responses];
    this.calls = [];
  }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    return this.responses.shift() ?? [{ affectedRows: 1 }, []];
  }
}

test("Learning Path persistence adapters implement segregated application ports", () => {
  const pool = new RecordingPool();
  assert.ok(new MySqlLearningPathDefinitionQueryRepository(pool) instanceof LearningPathDefinitionReader);
  assert.ok(new MySqlLearningPathDefinitionCommandRepository(pool) instanceof LearningPathDefinitionWriter);
  assert.ok(new MySqlLearningPathProgressQueryRepository(pool) instanceof LearningPathProgressReader);
  assert.ok(new MySqlLearningPathProgressCommandRepository(pool) instanceof LearningPathProgressWriter);
  assert.ok(new MySqlLearningPathTransactionManager(new ConnectionPool(new TransactionConnection())) instanceof LearningPathTransactionManager);
});

test("Learning Path transaction manager commits successful work and releases the connection", async () => {
  const connection = new TransactionConnection();
  const manager = new MySqlLearningPathTransactionManager(new ConnectionPool(connection));
  const result = await manager.execute(async (transaction) => {
    assert.equal(transaction, connection);
    return "done";
  });
  assert.equal(result, "done");
  assert.deepEqual(connection.events, ["begin", "commit", "release"]);
});

test("Learning Path transaction manager rolls back failed work and releases the connection", async () => {
  const connection = new TransactionConnection();
  const manager = new MySqlLearningPathTransactionManager(new ConnectionPool(connection));
  await assert.rejects(manager.execute(async () => { throw new Error("write failed"); }), /write failed/u);
  assert.deepEqual(connection.events, ["begin", "rollback", "release"]);
});

test("definition persistence stores variable exercise configuration as JSON without hiding stable fields", async () => {
  const pool = new RecordingPool();
  const repository = new MySqlLearningPathDefinitionCommandRepository(pool);
  await repository.upsertExercise("lesson-1", {
    id: "exercise-1",
    position: 2,
    type: "listening.ielts",
    schemaVersion: 1,
    required: true,
    completionPolicy: "submitted-listening-attempt",
    config: { lessonSlug: "episode", testId: "test-2" },
    status: "published",
    introducedVersion: 4,
    publishedAt: "2026-09-06 12:00:00.000",
  });

  assert.match(pool.calls[0].sql, /type, schema_version, required, completion_policy/u);
  assert.match(pool.calls[0].sql, /config_json/u);
  assert.equal(pool.calls[0].parameters[6], JSON.stringify({ lessonSlug: "episode", testId: "test-2" }));
  assert.equal(pool.calls[0].parameters.at(-1), "lesson-1");
});

test("progress persistence converts application ISO timestamps before handing them to mysql2", async () => {
  const pool = new RecordingPool();
  const repository = new MySqlLearningPathProgressCommandRepository(pool);
  const startedAt = "2026-09-07T02:45:00.123Z";
  const lastActivityAt = "2026-09-07T02:46:00.456Z";

  await repository.upsertPathProgress({
    userId: "user-1",
    pathId: "path-1",
    status: "in_progress",
    startedAt,
    completedAt: null,
    lastActivityAt,
    lastSeenContentVersion: 4,
  });

  const parameters = pool.calls[0].parameters;
  assert.ok(parameters[2] instanceof Date);
  assert.equal(parameters[2].toISOString(), startedAt);
  assert.equal(parameters[3], null);
  assert.ok(parameters[4] instanceof Date);
  assert.equal(parameters[4].toISOString(), lastActivityAt);
});

test("progress reads scope every projection query by user and path identity", async () => {
  const pool = new RecordingPool([
    [[{ status: "in_progress", startedAt: "a", completedAt: null, lastActivityAt: "b", lastSeenContentVersion: 2 }], []],
    [[{ lessonId: "lesson-1", status: "completed", startedAt: "a", completedAt: "b", lastActivityAt: "b" }], []],
    [[{ exerciseId: "exercise-1", status: "completed", startedAt: "a", completedAt: "b", lastActivityAt: "b", evidenceType: "attempt", evidenceRef: "attempt-1" }], []],
  ]);
  const repository = new MySqlLearningPathProgressQueryRepository(pool);
  const result = await repository.findForPath("user-7", "path-9");

  assert.equal(result.path.lastSeenContentVersion, 2);
  assert.equal(result.lessons[0].lessonId, "lesson-1");
  assert.equal(result.exercises[0].evidenceRef, "attempt-1");
  assert.deepEqual(pool.calls.map((call) => call.parameters), [
    ["user-7", "path-9"],
    ["user-7", "path-9"],
    ["user-7", "path-9"],
  ]);
});

test("migration keeps path structure relational and protects progress-bearing content from hard deletion", async () => {
  const migration = await readFile(new URL("../database/migrations/018_collection_learning_paths.sql", import.meta.url), "utf8");
  for (const table of [
    "collection_learning_paths",
    "learning_path_lessons",
    "learning_path_exercises",
    "user_learning_path_progress",
    "user_learning_path_lesson_progress",
    "user_learning_path_exercise_progress",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, "u"));
  }
  assert.match(migration, /type VARCHAR\(96\) NOT NULL/u);
  assert.match(migration, /schema_version INT UNSIGNED NOT NULL/u);
  assert.match(migration, /completion_policy VARCHAR\(96\) NOT NULL/u);
  assert.match(migration, /config_json JSON NOT NULL/u);
  assert.match(migration, /PRIMARY KEY \(user_id, exercise_id\)/u);
  assert.match(migration, /learning_path_exercises_lesson_fk[\s\S]*ON DELETE RESTRICT/u);
  assert.match(migration, /user_learning_path_exercise_progress_exercise_fk[\s\S]*ON DELETE RESTRICT/u);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM/u);
});

test("route identity migration creates generated immutable numeric ids without rewriting resource keys", async () => {
  const migration = await readFile(new URL("../database/migrations/020_learning_path_route_public_ids.sql", import.meta.url), "utf8");

  for (const [mappingTable, resourceTable, foreignKey] of [
    ["learning_path_route_ids", "collection_learning_paths", "learning_path_id"],
    ["learning_path_lesson_route_ids", "learning_path_lessons", "lesson_id"],
    ["learning_path_exercise_route_ids", "learning_path_exercises", "exercise_id"],
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${mappingTable}[\\s\\S]*public_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT`, "u"));
    assert.match(migration, new RegExp(`UNIQUE KEY ${mappingTable}_resource_unique \\(${foreignKey}\\)`, "u"));
    assert.match(migration, new RegExp(`INSERT INTO ${mappingTable} \\(${foreignKey}\\)[\\s\\S]*SELECT id FROM ${resourceTable}`, "u"));
  }

  assert.match(migration, /AFTER INSERT ON collection_learning_paths/u);
  assert.match(migration, /AFTER INSERT ON learning_path_lessons/u);
  assert.match(migration, /AFTER INSERT ON learning_path_exercises/u);
  assert.match(migration, /BEFORE UPDATE ON learning_path_route_ids/u);
  assert.match(migration, /BEFORE UPDATE ON learning_path_lesson_route_ids/u);
  assert.match(migration, /BEFORE UPDATE ON learning_path_exercise_route_ids/u);
  assert.match(migration, /BEFORE DELETE ON learning_path_route_ids/u);
  assert.match(migration, /BEFORE DELETE ON learning_path_lesson_route_ids/u);
  assert.match(migration, /BEFORE DELETE ON learning_path_exercise_route_ids/u);
  assert.match(migration, /BEFORE INSERT ON learning_path_route_ids/u);
  assert.match(migration, /SIGNAL SQLSTATE '45000'/u);
  assert.match(migration, /learning_path_route_identity_complete CHECK \(missing_count = 0\)/u);
  assert.match(migration, /BEFORE UPDATE ON collection_learning_paths/u);
  assert.match(migration, /BEFORE UPDATE ON learning_path_lessons/u);
  assert.match(migration, /BEFORE UPDATE ON learning_path_exercises/u);
  assert.ok(
    migration.indexOf("AFTER INSERT ON collection_learning_paths")
      < migration.indexOf("INSERT IGNORE INTO learning_path_route_ids"),
    "assignment triggers must be installed before backfill",
  );
  assert.doesNotMatch(migration, /ALTER TABLE collection_learning_paths[\s\S]*MODIFY COLUMN id|DROP COLUMN|DELETE FROM/u);
});

test("definition queries resolve canonical route ids while retaining source identity internally", async () => {
  const pool = new RecordingPool([
    [[{ id: "source-path", publicId: "1", collectionId: "collection-1", title: "Path", mode: "finite", status: "published", contentVersion: 1 }], []],
    [[{ id: "source-lesson", publicId: "5", title: "Lesson", position: 1, status: "published", introducedVersion: 1 }], []],
    [[{ lessonId: "source-lesson", id: "source-exercise", publicId: "10", position: 1, type: "fixture", schemaVersion: 1, required: 1, completionPolicy: "explicit", configJson: {} }], []],
  ]);
  const repository = new MySqlLearningPathDefinitionQueryRepository(pool);

  const path = await repository.findByRoutePublicId("1");

  assert.equal(pool.calls[0].parameters[0], "1");
  assert.match(pool.calls[0].sql, /learning_path_route_ids/u);
  assert.equal(path.id, "source-path");
  assert.equal(path.publicId, "1");
  assert.equal(path.lessons[0].publicId, "5");
  assert.equal(path.lessons[0].exercises[0].publicId, "10");
});
