import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { GetVocabularyMasteryCheckContext } from "../../src/application/collection-learning-path/queries/GetVocabularyMasteryCheckContext.js";
import { VerifyVocabularyMasteryCheckCompletion } from "../../src/application/collection-learning-path/queries/VerifyVocabularyMasteryCheckCompletion.js";
import {
  VOCABULARY_MASTERY_CHECK_SESSION_MODE,
  createVocabularyMasteryCheckSessionMetadata,
} from "../../src/domain/collection-learning-path/VocabularyMasteryCheck.js";
import { loadConfig } from "../../src/config/loadConfig.js";
import { createPool } from "../../src/infrastructure/persistence/mysql/createPool.js";
import { MySqlPracticeSessionRepository } from "../../src/infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js";
import { MySqlLearningPathMasteryCheckEvidenceQueryRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathMasteryCheckEvidenceQueryRepository.js";
import { MySqlLearningPathMasteryCheckSessionCommandRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathMasteryCheckSessionCommandRepository.js";
import { MySqlLearningPathVocabularyIntakeQueryRepository } from "../../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeQueryRepository.js";

const exercise = (episodeId) => ({
  id: "mastery-fixture",
  type: "vocabulary.mastery-check",
  schemaVersion: 1,
  completionPolicy: "vocabulary-mastery-check",
  config: { scope: { kind: "listening-episode", ref: episodeId } },
});

test("Learning Path mastery check persists and verifies the authoritative MySQL session snapshot", {
  skip: process.env.LEARNING_PATH_MYSQL_INTEGRATION !== "1",
}, async (t) => {
  assert.match(process.env.DB_NAME || "", /_ci$/u, "Never run Learning Path fixtures against a production database.");
  const config = loadConfig(process.env);
  const pool = createPool(config.database);
  const suffix = randomUUID().replaceAll("-", "");
  const ids = {
    collection: `lp-mastery-vocab-${suffix}`,
    episode: `lp-mastery-episode-${suffix}`,
    vocabulary: [`lp-mastery-a-${suffix}`, `lp-mastery-b-${suffix}`],
  };
  let userId = null;
  let otherUserId = null;

  t.after(async () => {
    try {
      if (userId != null || otherUserId != null) {
        const users = [userId, otherUserId].filter((value) => value != null);
        for (const id of users) {
          await pool.execute("DELETE FROM review_events WHERE user_id = ?", [id]);
          await pool.execute("DELETE FROM practice_sessions WHERE user_id = ?", [id]);
          await pool.execute("DELETE FROM user_vocabulary_progress WHERE user_id = ?", [id]);
        }
      }
      await pool.execute("DELETE FROM collection_entries WHERE collection_id IN (SELECT id FROM collections WHERE public_id = ?)", [ids.collection]);
      await pool.execute("DELETE FROM listening_lessons WHERE public_id = ?", [ids.episode]);
      const placeholders = ids.vocabulary.map(() => "?").join(", ");
      await pool.execute(`DELETE FROM vocabulary_entries WHERE public_id IN (${placeholders})`, ids.vocabulary);
      await pool.execute("DELETE FROM collections WHERE public_id = ?", [ids.collection]);
      if (otherUserId != null) await pool.execute("DELETE FROM users WHERE id = ?", [otherUserId]);
      if (userId != null) await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
    } finally {
      await pool.end();
    }
  });

  const [user] = await pool.execute(
    "INSERT INTO users (email, password_hash) VALUES (?, 'integration-only')",
    [`lp-mastery-${suffix}@example.test`],
  );
  userId = String(user.insertId);
  const [otherUser] = await pool.execute(
    "INSERT INTO users (email, password_hash) VALUES (?, 'integration-only')",
    [`lp-mastery-other-${suffix}@example.test`],
  );
  otherUserId = String(otherUser.insertId);

  await pool.execute(
    `INSERT INTO collections (public_id, slug, title, kind, visibility, status)
     VALUES (?, ?, 'Mastery vocabulary fixture', 'collection', 'public', 'published')`,
    [ids.collection, `lp-mastery-vocab-${suffix}`],
  );
  const [[collection]] = await pool.execute("SELECT id FROM collections WHERE public_id = ?", [ids.collection]);
  await pool.execute(
    `INSERT INTO listening_lessons
       (public_id, provider, slug, title, source_url, status, question_count, source_hash, content_json, vocabulary_collection_id)
     VALUES (?, 'bbc-6-minute-english', ?, 'Mastery episode fixture', 'https://example.test/mastery', 'published', 1, ?, JSON_OBJECT(), ?)`,
    [ids.episode, `lp-mastery-episode-${suffix}`, "b".repeat(64), ids.collection],
  );

  const vocabularyDbIds = [];
  for (const [index, publicId] of ids.vocabulary.entries()) {
    const term = `mastery-term-${index}-${suffix}`;
    const [result] = await pool.execute(
      `INSERT INTO vocabulary_entries
         (public_id, language_code, primary_form, normalized_form, canonical_key, status)
       VALUES (?, 'en', ?, ?, ?, 'active')`,
      [publicId, term, term, `en:${term}`],
    );
    vocabularyDbIds.push(String(result.insertId));
    await pool.execute(
      `INSERT INTO collection_entries
         (public_id, collection_id, vocabulary_entry_id, position, display_form)
       VALUES (?, ?, ?, ?, ?)`,
      [`lp-mastery-ce-${index}-${suffix}`, collection.id, result.insertId, index + 1, term],
    );
  }

  for (const vocabularyEntryId of vocabularyDbIds) {
    await pool.execute(
      `INSERT INTO user_vocabulary_progress
         (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
          current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on, blocked_until, mastered_at)
       VALUES (?, ?, 'active', 5, NULL, 12, 12, 0, 5, '2026-08-01', 'daily', NULL, NULL, NULL, '2026-09-02 00:00:00.000')`,
      [userId, vocabularyEntryId],
    );
  }

  const scopedVocabularyReader = new MySqlLearningPathVocabularyIntakeQueryRepository(pool);
  const contextQuery = new GetVocabularyMasteryCheckContext({ scopedVocabularyReader });
  const masteryExercise = exercise(ids.episode);
  const payload = await contextQuery.execute({ userId, exercise: masteryExercise });
  assert.deepEqual(payload.items.map((item) => item.id), ids.vocabulary);

  const practiceSessions = new MySqlPracticeSessionRepository(pool);
  const sessionWriter = new MySqlLearningPathMasteryCheckSessionCommandRepository(practiceSessions);
  const metadata = createVocabularyMasteryCheckSessionMetadata(
    masteryExercise,
    payload.scope,
    payload.items.map((item) => item.id),
  );
  const session = await sessionWriter.start(userId, {
    mode: VOCABULARY_MASTERY_CHECK_SESSION_MODE,
    plannedCount: payload.items.length,
    metadata,
  });

  const [[storedSession]] = await pool.execute(
    "SELECT id, metadata_json FROM practice_sessions WHERE public_id = ? AND user_id = ?",
    [session.id, userId],
  );
  const storedMetadata = typeof storedSession.metadata_json === "string"
    ? JSON.parse(storedSession.metadata_json)
    : storedSession.metadata_json;
  assert.deepEqual(storedMetadata, metadata);

  for (const [index, vocabularyEntryId] of vocabularyDbIds.entries()) {
    await pool.execute(
      `INSERT INTO review_events
         (event_key, user_id, vocabulary_entry_id, collection_id, practice_session_id,
          occurred_at, local_day, answer, correct, mode, previous_box, new_box, promoted, mistake_number, term_snapshot)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), '2026-09-06', ?, ?, 'review', 5, ?, FALSE, ?, ?)`,
      [
        `${index}`.padEnd(64, index === 0 ? "a" : "b"),
        userId,
        vocabularyEntryId,
        collection.id,
        storedSession.id,
        index === 0 ? "remembered" : "",
        index === 0,
        index === 0 ? 5 : 1,
        index === 0 ? null : 1,
        `mastery-term-${index}-${suffix}`,
      ],
    );
  }
  await practiceSessions.complete(userId, session.id, {
    completedCount: 2,
    correctCount: 1,
    wrongCount: 1,
    durationSeconds: 12,
  });

  const evidenceReader = new MySqlLearningPathMasteryCheckEvidenceQueryRepository(pool);
  const evidence = await evidenceReader.findCompletedSession(userId, session.id);
  assert.equal(evidence.mode, VOCABULARY_MASTERY_CHECK_SESSION_MODE);
  assert.equal(evidence.status, "completed");
  assert.equal(evidence.plannedCount, 2);
  assert.equal(evidence.completedCount, 2);
  assert.deepEqual(evidence.metadata, metadata);
  assert.deepEqual(evidence.reviewedVocabularyIds, ids.vocabulary);
  assert.equal(await evidenceReader.findCompletedSession(otherUserId, session.id), null);

  const verifier = new VerifyVocabularyMasteryCheckCompletion({
    scopedVocabularyReader,
    masteryCheckEvidenceReader: evidenceReader,
  });
  const completion = await verifier.execute({
    userId,
    exercise: masteryExercise,
    outcome: { kind: "completed", evidence: { sessionId: session.id } },
  });
  assert.equal(completion.evidenceType, "vocabulary-mastery-check");
  assert.match(completion.evidenceRef, new RegExp(`session:${session.id}$`, "u"));
});
