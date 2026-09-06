import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { loadConfig } from "../../src/config/loadConfig.js";
import { createPool } from "../../src/infrastructure/persistence/mysql/createPool.js";
import { MySqlLearningPathDefinitionCommandRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionCommandRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";
import { MySqlLearningPathProgressCommandRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressCommandRepository.js";
import { MySqlLearningPathProgressQueryRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressQueryRepository.js";
import { MySqlLearningPathTransactionManager } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathTransactionManager.js";

const now = "2026-09-06 14:30:00.000";
const later = "2026-09-06 15:00:00.000";

const pathDefinition = (ids, overrides = {}) => ({
  id: ids.path,
  collectionId: ids.collection,
  title: "Persistence integration path",
  mode: "rolling",
  status: "published",
  contentVersion: 1,
  sourceHash: "a".repeat(64),
  publishedAt: now,
  retiredAt: null,
  ...overrides,
});

const lessonDefinition = (ids, overrides = {}) => ({
  id: ids.lesson,
  title: "Episode one",
  position: 1,
  sourceKind: "listening-episode",
  sourceRef: "episode-fixture",
  status: "published",
  introducedVersion: 1,
  retiredVersion: null,
  publishedAt: now,
  retiredAt: null,
  ...overrides,
});

const exerciseDefinition = (ids, overrides = {}) => ({
  id: ids.exercise,
  position: 1,
  type: "listening.ielts",
  schemaVersion: 1,
  required: true,
  completionPolicy: "submitted-listening-attempt",
  config: { lessonSlug: "episode-fixture", testId: "test-1" },
  status: "published",
  introducedVersion: 1,
  retiredVersion: null,
  publishedAt: now,
  retiredAt: null,
  ...overrides,
});

test("Collection Learning Path persistence is transactional, idempotent, and user-isolated on MySQL", {
  skip: process.env.LEARNING_PATH_MYSQL_INTEGRATION !== "1",
}, async (t) => {
  assert.match(process.env.DB_NAME || "", /_ci$/u, "Never run Learning Path fixtures against a production database.");
  const config = loadConfig(process.env);
  const pool = createPool(config.database);
  const suffix = randomUUID();
  const ids = {
    collection: `lp-collection-${suffix}`,
    path: `lp-path-${suffix}`,
    lesson: `lp-lesson-${suffix}`,
    exercise: `lp-exercise-${suffix}`,
    rollbackPath: `lp-rollback-${suffix}`,
  };
  const users = [];

  t.after(async () => {
    try {
      if (users.length) {
        const placeholders = users.map(() => "?").join(", ");
        await pool.execute(`DELETE FROM user_learning_path_exercise_progress WHERE user_id IN (${placeholders})`, users);
        await pool.execute(`DELETE FROM user_learning_path_lesson_progress WHERE user_id IN (${placeholders})`, users);
        await pool.execute(`DELETE FROM user_learning_path_progress WHERE user_id IN (${placeholders})`, users);
      }
      await pool.execute("DELETE FROM learning_path_exercises WHERE public_id = ?", [ids.exercise]);
      await pool.execute("DELETE FROM learning_path_lessons WHERE public_id = ?", [ids.lesson]);
      await pool.execute("DELETE FROM collection_learning_paths WHERE public_id IN (?, ?)", [ids.path, ids.rollbackPath]);
      await pool.execute("DELETE FROM collections WHERE public_id = ?", [ids.collection]);
      for (const userId of users) await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
    } finally {
      await pool.end();
    }
  });

  await pool.execute(
    `INSERT INTO collections (public_id, slug, title, kind, visibility, status)
     VALUES (?, ?, 'Learning Path fixture collection', 'course', 'public', 'published')`,
    [ids.collection, `lp-fixture-${suffix}`],
  );
  for (let index = 0; index < 2; index += 1) {
    const [result] = await pool.execute(
      "INSERT INTO users (email, password_hash) VALUES (?, 'integration-only')",
      [`lp-persistence-${index}-${suffix}@example.test`],
    );
    users.push(String(result.insertId));
  }
  const [learner, otherLearner] = users;

  const definitions = new MySqlLearningPathDefinitionCommandRepository(pool);
  const definitionQueries = new MySqlLearningPathDefinitionQueryRepository(pool);
  const progress = new MySqlLearningPathProgressCommandRepository(pool);
  const progressQueries = new MySqlLearningPathProgressQueryRepository(pool);
  const transactions = new MySqlLearningPathTransactionManager(pool);

  await t.test("definition writes are atomic and repeatable without duplicate identities", async () => {
    await transactions.execute(async (connection) => {
      for (let pass = 0; pass < 2; pass += 1) {
        await definitions.upsertPath(pathDefinition(ids), { connection });
        await definitions.upsertLesson(ids.path, lessonDefinition(ids), { connection });
        await definitions.upsertExercise(ids.lesson, exerciseDefinition(ids), { connection });
      }
    });

    const [[counts]] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM collection_learning_paths WHERE public_id = ?) AS paths,
        (SELECT COUNT(*) FROM learning_path_lessons WHERE public_id = ?) AS lessons,
        (SELECT COUNT(*) FROM learning_path_exercises WHERE public_id = ?) AS exercises`,
      [ids.path, ids.lesson, ids.exercise],
    );
    assert.deepEqual(
      { paths: Number(counts.paths), lessons: Number(counts.lessons), exercises: Number(counts.exercises) },
      { paths: 1, lessons: 1, exercises: 1 },
    );

    const read = await definitionQueries.findActiveByCollectionPublicId(ids.collection);
    assert.equal(read.id, ids.path);
    assert.equal(read.contentVersion, 1);
    assert.equal(read.lessons[0].id, ids.lesson);
    assert.deepEqual(read.lessons[0].exercises[0].config, {
      lessonSlug: "episode-fixture",
      testId: "test-1",
    });
  });

  await t.test("progress writes remain scoped to the authenticated learner identity", async () => {
    await transactions.execute(async (connection) => {
      for (let pass = 0; pass < 2; pass += 1) {
        await progress.upsertPathProgress({
          userId: learner,
          pathId: ids.path,
          status: "in_progress",
          startedAt: now,
          completedAt: null,
          lastActivityAt: later,
          lastSeenContentVersion: 1,
        }, { connection });
        await progress.upsertLessonProgress({
          userId: learner,
          lessonId: ids.lesson,
          status: "in_progress",
          startedAt: now,
          completedAt: null,
          lastActivityAt: later,
        }, { connection });
        await progress.upsertExerciseProgress({
          userId: learner,
          exerciseId: ids.exercise,
          status: "completed",
          startedAt: now,
          completedAt: later,
          lastActivityAt: later,
          evidenceType: "listening-attempt",
          evidenceRef: "attempt-fixture",
        }, { connection });
      }
    });

    const own = await progressQueries.findForPath(learner, ids.path);
    assert.equal(own.path.status, "in_progress");
    assert.equal(own.lessons.length, 1);
    assert.deepEqual(own.exercises.map((item) => [item.exerciseId, item.status, item.evidenceRef]), [
      [ids.exercise, "completed", "attempt-fixture"],
    ]);

    const isolated = await progressQueries.findForPath(otherLearner, ids.path);
    assert.deepEqual(isolated, { path: null, lessons: [], exercises: [] });
  });

  await t.test("content updates preserve identity and existing learner progress", async () => {
    await transactions.execute(async (connection) => {
      await definitions.upsertPath(pathDefinition(ids, { title: "Updated path", contentVersion: 2, sourceHash: "b".repeat(64) }), { connection });
      await definitions.upsertLesson(ids.path, lessonDefinition(ids, { title: "Updated episode", position: 2 }), { connection });
      await definitions.upsertExercise(ids.lesson, exerciseDefinition(ids, { position: 3 }), { connection });
    });

    const read = await definitionQueries.findByPublicId(ids.path);
    assert.equal(read.title, "Updated path");
    assert.equal(read.contentVersion, 2);
    assert.equal(read.lessons[0].position, 2);
    assert.equal(read.lessons[0].exercises[0].position, 3);

    const persistedProgress = await progressQueries.findForPath(learner, ids.path);
    assert.equal(persistedProgress.exercises[0].status, "completed");
    assert.equal(persistedProgress.exercises[0].evidenceRef, "attempt-fixture");
  });

  await t.test("retirement is soft, idempotent, and keeps historical progress explainable", async () => {
    const first = await definitions.retireExercise(ids.exercise, { version: 3, at: later });
    const repeated = await definitions.retireExercise(ids.exercise, { version: 3, at: later });
    await definitions.retireLesson(ids.lesson, { version: 3, at: later });
    assert.equal(first.changed, true);
    assert.equal(repeated.changed, false);

    const active = await definitionQueries.findByPublicId(ids.path);
    assert.deepEqual(active.lessons, []);
    const historical = await definitionQueries.findByPublicId(ids.path, { includeRetired: true });
    assert.equal(historical.lessons[0].status, "retired");
    assert.equal(historical.lessons[0].exercises[0].status, "retired");

    const persistedProgress = await progressQueries.findForPath(learner, ids.path);
    assert.equal(persistedProgress.exercises[0].status, "completed");
    await assert.rejects(
      pool.execute("DELETE FROM learning_path_exercises WHERE public_id = ?", [ids.exercise]),
      (error) => error?.code === "ER_ROW_IS_REFERENCED_2",
    );
  });

  await t.test("path retirement is soft and repeatable without deleting learner history", async () => {
    const first = await definitions.retirePath(ids.path, { at: later });
    const repeated = await definitions.retirePath(ids.path, { at: later });
    assert.equal(first.changed, true);
    assert.equal(repeated.changed, false);
    assert.equal(await definitionQueries.findActiveByCollectionPublicId(ids.collection), null);
    const historical = await definitionQueries.findByPublicId(ids.path, { includeRetired: true });
    assert.equal(historical.status, "retired");
    const persistedProgress = await progressQueries.findForPath(learner, ids.path);
    assert.equal(persistedProgress.exercises[0].status, "completed");
  });

  await t.test("transaction manager rolls back partial definition writes", async () => {
    await assert.rejects(
      transactions.execute(async (connection) => {
        await definitions.upsertPath(pathDefinition(ids, { id: ids.rollbackPath, title: "Must roll back" }), { connection });
        throw new Error("force rollback");
      }),
      /force rollback/u,
    );
    assert.equal(await definitionQueries.findByPublicId(ids.rollbackPath, { includeRetired: true }), null);
  });
});
