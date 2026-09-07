import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { loadConfig } from "../../src/config/loadConfig.js";
import { createPool } from "../../src/infrastructure/persistence/mysql/createPool.js";
import { MySqlLearningPathProgressCommandRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressCommandRepository.js";

const STARTED_AT = "2026-09-07T15:00:00.000Z";
const LATER_AT = "2026-09-07T15:05:00.000Z";

test("Learning Path optimistic progress updates execute on MySQL without ambiguous target columns", {
  skip: process.env.LEARNING_PATH_MYSQL_INTEGRATION !== "1",
}, async (t) => {
  assert.match(process.env.DB_NAME || "", /_ci$/u, "Never run Learning Path fixtures against a production database.");
  const config = loadConfig(process.env);
  const pool = createPool(config.database);
  const suffix = randomUUID().replaceAll("-", "");
  const ids = {
    collection: `lp-cas-col-${suffix}`,
    path: `lp-cas-path-${suffix}`,
  };
  let userId = null;

  t.after(async () => {
    try {
      if (userId != null) {
        await pool.execute("DELETE FROM user_learning_path_progress WHERE user_id = ?", [userId]);
      }
      await pool.execute("DELETE FROM collection_learning_paths WHERE public_id = ?", [ids.path]);
      await pool.execute("DELETE FROM collections WHERE public_id = ?", [ids.collection]);
      if (userId != null) await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
    } finally {
      await pool.end();
    }
  });

  const [user] = await pool.execute(
    "INSERT INTO users (email, password_hash) VALUES (?, 'integration-only')",
    [`lp-cas-${suffix}@example.test`],
  );
  userId = String(user.insertId);

  await pool.execute(
    `INSERT INTO collections (public_id, slug, title, kind, visibility, status)
     VALUES (?, ?, 'Learning Path CAS fixture', 'course', 'public', 'published')`,
    [ids.collection, `lp-cas-${suffix}`],
  );
  const [[collection]] = await pool.execute(
    "SELECT id FROM collections WHERE public_id = ?",
    [ids.collection],
  );
  await pool.execute(
    `INSERT INTO collection_learning_paths
       (public_id, collection_id, title, mode, status, content_version, published_at)
     VALUES (?, ?, 'Learning Path CAS fixture', 'finite', 'published', 1, ?)`,
    [ids.path, collection.id, new Date(STARTED_AT)],
  );

  const repository = new MySqlLearningPathProgressCommandRepository(pool);
  const initial = {
    userId,
    pathId: ids.path,
    status: "in_progress",
    startedAt: STARTED_AT,
    completedAt: null,
    lastActivityAt: STARTED_AT,
    lastSeenContentVersion: 1,
  };

  const inserted = await repository.upsertPathProgress({
    ...initial,
    expectedRevision: 0,
  });
  assert.deepEqual(inserted, { changed: true, conflict: false, revision: 1 });

  const updated = await repository.upsertPathProgress({
    ...initial,
    lastActivityAt: LATER_AT,
    expectedRevision: 1,
  });
  assert.deepEqual(updated, { changed: true, conflict: false, revision: 2 });

  const stale = await repository.upsertPathProgress({
    ...initial,
    status: "completed",
    completedAt: LATER_AT,
    lastActivityAt: LATER_AT,
    expectedRevision: 1,
  });
  assert.equal(stale.conflict, true);

  const [[saved]] = await pool.execute(
    `SELECT up.status, up.revision
     FROM user_learning_path_progress up
     JOIN collection_learning_paths p ON p.id = up.learning_path_id
     WHERE up.user_id = ? AND p.public_id = ?`,
    [userId, ids.path],
  );
  assert.deepEqual(
    { status: saved.status, revision: Number(saved.revision) },
    { status: "in_progress", revision: 2 },
  );
});
