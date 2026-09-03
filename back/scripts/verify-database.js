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

    const [sentenceRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM sentences
       WHERE status = 'active'`
    );
    const sentenceTotal = Number(sentenceRows[0]?.total ?? 0);
    if (sentenceTotal <= 0) throw new Error("The independent sentence catalog is empty.");

    const [forbiddenSentenceColumnRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND COLUMN_NAME IN (
           'vocabulary_entry_id', 'word_id', 'answer_text',
           'language_code', 'source_key', 'source_item_number',
           'variant_number', 'category', 'source_hash'
         )`
    );
    if (Number(forbiddenSentenceColumnRows[0]?.total ?? 0) !== 0) {
      throw new Error("Sentence catalog contains columns that are no longer part of the minimal runtime schema.");
    }

    const [requiredSentenceColumnRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND COLUMN_NAME IN ('id', 'sentence_text', 'status', 'created_at', 'updated_at')`
    );
    if (Number(requiredSentenceColumnRows[0]?.total ?? 0) !== 5) {
      throw new Error("Sentence catalog is missing one or more required runtime columns.");
    }

    const [sentenceForeignKeyRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    if (Number(sentenceForeignKeyRows[0]?.total ?? 0) !== 0) {
      throw new Error("Sentence catalog must remain independent and contain no foreign keys.");
    }

    const [legacySentenceTableRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('vocabulary_sentences', 'sentence_word_links')`
    );
    if (Number(legacySentenceTableRows[0]?.total ?? 0) !== 0) {
      throw new Error("Vocabulary-linked sentence tables must not exist.");
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
      `Database verification passed: ${sourceItemCount} IELTS source items normalize to ${uniqueVocabularyCount} unique vocabulary entries; the minimal independent sentence catalog contains ${sentenceTotal} active rows.`
    );
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Database verification failed:", error.message);
  process.exitCode = 1;
});
