import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { GetVocabularyIntakeContext } from "../../src/application/collection-learning-path/queries/GetVocabularyIntakeContext.js";
import { GetLeitnerHouse } from "../../src/application/learning/GetLeitnerHouse.js";
import { loadConfig } from "../../src/config/loadConfig.js";
import { createPool } from "../../src/infrastructure/persistence/mysql/createPool.js";
import { MySqlLearningBootstrapRepository } from "../../src/infrastructure/persistence/mysql/MySqlLearningBootstrapRepository.js";
import { MySqlLearningStateRepository } from "../../src/infrastructure/persistence/mysql/MySqlLearningStateRepository.js";
import { MySqlVocabularyActivationRepository } from "../../src/infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";
import { MySqlLearningPathVocabularyIntakeCommandRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeCommandRepository.js";
import { MySqlLearningPathVocabularyIntakeQueryRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeQueryRepository.js";

const exercise = (episodeId) => ({
  id: "intake-fixture",
  type: "vocabulary.intake",
  schemaVersion: 1,
  completionPolicy: "vocabulary-intake",
  config: { scope: { kind: "listening-episode", ref: episodeId } },
});

test("Learning Path vocabulary intake persists in the global Leitner state without a second subscription on MySQL", {
  skip: process.env.LEARNING_PATH_MYSQL_INTEGRATION !== "1",
}, async (t) => {
  assert.match(process.env.DB_NAME || "", /_ci$/u, "Never run Learning Path fixtures against a production database.");
  const config = loadConfig(process.env);
  const pool = createPool(config.database);
  const suffix = randomUUID().replaceAll("-", "");
  const ids = {
    courseCollection: `lp-course-${suffix}`,
    vocabularyCollection: `lp-vocab-${suffix}`,
    episode: `lp-episode-${suffix}`,
    vocabulary: ["new", "learning", "mastered", "excluded"].map((name) => `lp-${name}-${suffix}`),
  };
  let userId = null;

  t.after(async () => {
    try {
      if (userId != null) {
        await pool.execute("DELETE FROM user_daily_stats WHERE user_id = ?", [userId]);
        await pool.execute("DELETE FROM user_vocabulary_progress WHERE user_id = ?", [userId]);
        await pool.execute("DELETE FROM user_collections WHERE user_id = ?", [userId]);
        await pool.execute("DELETE FROM user_state_revisions WHERE user_id = ?", [userId]);
      }
      await pool.execute("DELETE FROM collection_entries WHERE collection_id IN (SELECT id FROM collections WHERE public_id IN (?, ?))", [ids.courseCollection, ids.vocabularyCollection]);
      await pool.execute("DELETE FROM listening_lessons WHERE public_id = ?", [ids.episode]);
      const placeholders = ids.vocabulary.map(() => "?").join(", ");
      await pool.execute(`DELETE FROM vocabulary_entries WHERE public_id IN (${placeholders})`, ids.vocabulary);
      await pool.execute("DELETE FROM collections WHERE public_id IN (?, ?)", [ids.courseCollection, ids.vocabularyCollection]);
      if (userId != null) await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
    } finally {
      await pool.end();
    }
  });

  const [user] = await pool.execute(
    "INSERT INTO users (email, password_hash) VALUES (?, 'integration-only')",
    [`lp-intake-${suffix}@example.test`],
  );
  userId = String(user.insertId);
  await pool.execute("INSERT INTO user_state_revisions (user_id, revision) VALUES (?, 4)", [userId]);

  await pool.execute(
    `INSERT INTO collections (public_id, slug, title, kind, visibility, status)
     VALUES (?, ?, 'Course fixture', 'course', 'public', 'published'),
            (?, ?, 'Episode vocabulary fixture', 'collection', 'public', 'published')`,
    [ids.courseCollection, `lp-course-${suffix}`, ids.vocabularyCollection, `lp-vocab-${suffix}`],
  );
  const [[course]] = await pool.execute("SELECT id FROM collections WHERE public_id = ?", [ids.courseCollection]);
  const [[vocabularyCollection]] = await pool.execute("SELECT id FROM collections WHERE public_id = ?", [ids.vocabularyCollection]);
  await pool.execute(
    "INSERT INTO user_collections (user_id, collection_id, status) VALUES (?, ?, 'active')",
    [userId, course.id],
  );

  await pool.execute(
    `INSERT INTO listening_lessons
       (public_id, provider, slug, title, source_url, status, question_count, source_hash, content_json, vocabulary_collection_id)
     VALUES (?, 'bbc-6-minute-english', ?, 'Episode fixture', 'https://example.test/episode', 'published', 1, ?, JSON_OBJECT(), ?)`,
    [ids.episode, `episode-${suffix}`, "a".repeat(64), ids.vocabularyCollection],
  );

  const vocabularyRows = [];
  for (const [index, publicId] of ids.vocabulary.entries()) {
    const term = `term-${index}-${suffix}`;
    const [result] = await pool.execute(
      `INSERT INTO vocabulary_entries
         (public_id, language_code, primary_form, normalized_form, canonical_key, status)
       VALUES (?, 'en', ?, ?, ?, 'active')`,
      [publicId, term, term, `en:${term}`],
    );
    vocabularyRows.push(String(result.insertId));
    await pool.execute(
      `INSERT INTO collection_entries
         (public_id, collection_id, vocabulary_entry_id, position, display_form)
       VALUES (?, ?, ?, ?, ?)`,
      [`ce-${index}-${suffix}`, vocabularyCollection.id, result.insertId, index + 1, term],
    );
  }

  await pool.execute(
    `INSERT INTO user_vocabulary_progress
       (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
        current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on, blocked_until, mastered_at)
     VALUES
       (?, ?, 'active', 3, '2026-09-09', 4, 3, 1, 2, '2026-09-01', 'daily', NULL, NULL, NULL, NULL),
       (?, ?, 'active', 5, NULL, 12, 12, 0, 5, '2026-08-01', 'daily', NULL, NULL, NULL, '2026-09-02 00:00:00.000'),
       (?, ?, 'excluded', 0, NULL, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL)`,
    [
      userId, vocabularyRows[1],
      userId, vocabularyRows[2],
      userId, vocabularyRows[3],
    ],
  );

  const reader = new MySqlLearningPathVocabularyIntakeQueryRepository(pool);
  const query = new GetVocabularyIntakeContext({ vocabularyIntakeReader: reader });
  const activation = new MySqlVocabularyActivationRepository(pool);
  const writer = new MySqlLearningPathVocabularyIntakeCommandRepository(activation);

  const before = await query.execute({ userId, exercise: exercise(ids.episode) });
  assert.deepEqual(before.summary, {
    total: 4,
    newCount: 1,
    learningCount: 1,
    masteredCount: 1,
    excludedCount: 1,
  });
  const [[episodeSubscription]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM user_collections WHERE user_id = ? AND collection_id = ?",
    [userId, vocabularyCollection.id],
  );
  assert.equal(Number(episodeSubscription.count), 0, "episode vocabulary must not require a separate subscription");

  const write = await writer.activateUnseen(userId, {
    vocabularyIds: before.items.map((item) => item.id),
    day: "2026-09-06",
    source: "learning-path",
  });
  assert.deepEqual(write, { revision: 5, activatedCount: 1 });

  const after = await query.execute({ userId, exercise: exercise(ids.episode) });
  assert.equal(after.summary.newCount, 0);
  assert.deepEqual(after.items.map((item) => [item.id, item.progress.state, item.progress.box]), [
    [ids.vocabulary[0], "learning", 1],
    [ids.vocabulary[1], "learning", 3],
    [ids.vocabulary[2], "mastered", 5],
    [ids.vocabulary[3], "excluded", 0],
  ]);

  const globalRepository = new MySqlLearningStateRepository(pool);
  const globalState = await globalRepository.findByUserId(userId);
  const activatedGlobalWord = globalState.state.words.find((word) => word.id === ids.vocabulary[0]);
  assert.deepEqual(
    [activatedGlobalWord?.box, activatedGlobalWord?.introducedOn, activatedGlobalWord?.addedSource],
    [1, "2026-09-06", "learning-path"],
    "course intake must become ordinary global Leitner progress",
  );
  assert.equal(globalState.state.words.some((word) => word.id === ids.vocabulary[3]), false, "excluded vocabulary stays hidden globally");

  const bootstrapRepository = new MySqlLearningBootstrapRepository(pool, globalRepository);
  const bootstrap = await bootstrapRepository.findByUserId(userId);
  const bootstrapWord = bootstrap.state.words.find((word) => word.id === ids.vocabulary[0]);
  assert.equal(bootstrapWord?.box, 1, "bootstrap refresh must expose the newly activated global House 1 word");

  const houseOne = await new GetLeitnerHouse({
    learningStateRepository: globalRepository,
    today: () => "2026-09-06",
  }).execute(userId, 1);
  assert.ok(
    houseOne.words.some((word) => word.id === ids.vocabulary[0]),
    "the main Leitner House 1 must contain vocabulary activated from the course",
  );

  const [[subscriptionAfterActivation]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM user_collections WHERE user_id = ? AND collection_id = ?",
    [userId, vocabularyCollection.id],
  );
  assert.equal(Number(subscriptionAfterActivation.count), 0, "global progress must not create a per-course vocabulary subscription");

  const [[stats]] = await pool.execute(
    "SELECT new_added FROM user_daily_stats WHERE user_id = ? AND day = '2026-09-06'",
    [userId],
  );
  assert.equal(Number(stats.new_added), 1);
});
