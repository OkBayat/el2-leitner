import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

loadEnvironment({ path: new URL("../.env", import.meta.url), quiet: true });
loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseJson(value) {
  if (value === null || value === undefined) return {};
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  return typeof value === "string" ? JSON.parse(value) : value;
}

function verifyListeningContent(row) {
  const content = parseJson(row.content_json);
  if (Number(content.schemaVersion) !== Number(row.schema_version)) {
    throw new Error("BBC listening schema version does not match its stored JSON aggregate.");
  }
  if (!Array.isArray(content.tests) || content.tests.length !== 3) {
    throw new Error(`Expected 3 BBC listening tests, found ${content.tests?.length ?? 0}.`);
  }
  const expectedIds = ["test-1", "test-2", "test-3"];
  const questions = [];
  for (const [index, test] of content.tests.entries()) {
    if (test.id !== expectedIds[index]) {
      throw new Error(`Expected BBC test ${expectedIds[index]}, found ${test.id || "unknown"}.`);
    }
    if (!Array.isArray(test.groups) || test.groups.length !== 4) {
      throw new Error(`Expected 4 question groups in ${test.id}, found ${test.groups?.length ?? 0}.`);
    }
    const testQuestions = test.groups.flatMap((group) => Array.isArray(group.questions) ? group.questions : []);
    if (testQuestions.length !== 13 || Number(test.questionCount) !== 13) {
      throw new Error(`Expected 13 questions in ${test.id}, found ${testQuestions.length}.`);
    }
    questions.push(...testQuestions);
  }
  if (questions.length !== 39 || Number(row.question_count) !== 39) {
    throw new Error(`Expected 39 BBC listening questions in total, found ${questions.length}.`);
  }
  const missingAnswer = questions.find((question) => {
    if (question.responseType === "text") {
      return !Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length === 0;
    }
    if (question.responseType === "single_choice") {
      return !question.correctOptionId
        || !Array.isArray(question.options)
        || !question.options.some((option) => option.id === question.correctOptionId);
    }
    return true;
  });
  if (missingAnswer) {
    throw new Error(`BBC listening question ${missingAnswer.id || "unknown"} has no valid answer key.`);
  }
}

async function verify() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    connectionLimit: 2
  });
  try {
    const [seedRows] = await pool.execute(
      `SELECT c.metadata_json, COUNT(ce.id) AS total
       FROM collections c
       LEFT JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
       WHERE c.public_id = 'ielts-listening-core-1500'
       GROUP BY c.id`
    );
    if (!seedRows[0]) throw new Error("Built-in IELTS collection is missing.");
    const metadata = parseJson(seedRows[0].metadata_json);
    const activeUniqueItems = Number(seedRows[0].total);
    const sourceItemCount = Number(metadata.sourceItemCount);
    const uniqueVocabularyCount = Number(metadata.uniqueVocabularyCount);
    const duplicateAliasCount = Number(metadata.duplicateAliasCount);
    if (sourceItemCount !== 1500) {
      throw new Error(`Expected 1500 IELTS source items, found ${sourceItemCount}.`);
    }
    if (activeUniqueItems !== uniqueVocabularyCount) {
      throw new Error(
        `Built-in unique vocabulary count mismatch: metadata=${uniqueVocabularyCount}, active=${activeUniqueItems}.`
      );
    }
    if (sourceItemCount - uniqueVocabularyCount !== duplicateAliasCount || duplicateAliasCount < 0) {
      throw new Error("Built-in duplicate-alias metadata is inconsistent.");
    }

    const expectedListeningLessons = new Map([
      ["bbc-6-minute-english-260903", "2026-09-03-climate-change-extreme-weather"],
      ["bbc-6-minute-english-260618", "2026-06-18-limiting-screen-time-for-children"]
    ]);
    const [listeningRows] = await pool.execute(
      `SELECT public_id, schema_version, question_count, audio_file, asset_directory, image_file, content_json
       FROM listening_lessons
       WHERE provider = 'bbc_6_minute_english'
         AND status = 'published'
         AND public_id IN ('bbc-6-minute-english-260903', 'bbc-6-minute-english-260618')`
    );
    if (listeningRows.length !== expectedListeningLessons.size) {
      throw new Error(`Expected ${expectedListeningLessons.size} built-in BBC lessons, found ${listeningRows.length}.`);
    }
    for (const row of listeningRows) {
      const expectedAssetDirectory = expectedListeningLessons.get(String(row.public_id));
      if (!expectedAssetDirectory) throw new Error(`Unexpected BBC listening lesson ${row.public_id}.`);
      if (row.asset_directory !== expectedAssetDirectory) {
        throw new Error(`Unexpected BBC asset directory for ${row.public_id}: ${row.asset_directory || "missing"}.`);
      }
      if (row.audio_file !== "audio.mp3") {
        throw new Error(`Unexpected BBC audio filename for ${row.public_id}: ${row.audio_file || "missing"}.`);
      }
      if (row.image_file !== "cover.jpg") {
        throw new Error(`Unexpected BBC image filename for ${row.public_id}: ${row.image_file || "missing"}.`);
      }
      verifyListeningContent(row);
    }

    const [attemptColumns] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'listening_attempts'
         AND COLUMN_NAME = 'test_id'`
    );
    if (Number(attemptColumns[0].total) !== 1) {
      throw new Error("listening_attempts.test_id is required for per-test completion tracking.");
    }

    const [audioColumns] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'listening_lessons'
         AND COLUMN_NAME = 'audio_file'`
    );
    if (Number(audioColumns[0].total) !== 1) {
      throw new Error("listening_lessons.audio_file is required for local episode audio.");
    }

    const [obsoleteListeningTables] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (
           'listening_question_groups',
           'listening_questions',
           'listening_question_options',
           'listening_question_answers',
           'listening_attempt_answers'
         )`
    );
    if (Number(obsoleteListeningTables[0].total) !== 0) {
      throw new Error("Listening questions and answer keys must remain inside the lesson JSON aggregate.");
    }

    const [legacyRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM learning_states ls
       LEFT JOIN user_state_revisions usr ON usr.user_id = ls.user_id
       WHERE usr.user_id IS NULL`
    );
    if (Number(legacyRows[0].total) !== 0) {
      throw new Error(`${legacyRows[0].total} legacy learning state(s) have not been normalized.`);
    }

    const [unreconciledAliasRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM learning_states ls
       JOIN user_state_revisions usr ON usr.user_id = ls.user_id
       WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(usr.metadata_json, '$.legacyAliasProgressMerged')), 'false') NOT IN ('true', '1')`
    );
    if (Number(unreconciledAliasRows[0].total) !== 0) {
      throw new Error(`${unreconciledAliasRows[0].total} legacy learner(s) have not completed alias-progress reconciliation.`);
    }

    const [duplicateRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM (
         SELECT collection_id, vocabulary_entry_id
         FROM collection_entries
         WHERE removed_at IS NULL
         GROUP BY collection_id, vocabulary_entry_id
         HAVING COUNT(*) > 1
       ) duplicates`
    );
    if (Number(duplicateRows[0].total) !== 0) {
      throw new Error("Duplicate active collection memberships were found.");
    }

    console.info(
      `Database verification passed: ${sourceItemCount} source IELTS items normalize to ${uniqueVocabularyCount} unique vocabulary entries; two BBC lessons contain 6 JSON-backed tests, 78 graded questions, and episode-local assets; migration, alias reconciliation, and active membership invariants are valid.`
    );
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Database verification failed:", error.message);
  process.exitCode = 1;
});
