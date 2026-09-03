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

    const [requiredSentenceColumns] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND COLUMN_NAME IN (
           'sentence_text', 'audio_id', 'audio_url', 'audio_contributor',
           'audio_license', 'audio_attribution_url'
         )`
    );
    if (Number(requiredSentenceColumns[0]?.total ?? 0) !== 6) {
      throw new Error("Sentence catalog is missing Tatoeba audio metadata columns.");
    }

    const [fullTextRows] = await pool.execute(
      `SELECT COUNT(DISTINCT INDEX_NAME) AS total
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND INDEX_TYPE = 'FULLTEXT'
         AND COLUMN_NAME = 'sentence_text'`
    );
    if (Number(fullTextRows[0]?.total ?? 0) < 1) {
      throw new Error("Sentence catalog is missing its full-text lookup index.");
    }

    const [sentenceRows] = await pool.execute(
      `SELECT COUNT(*) AS total,
              COUNT(DISTINCT audio_id) AS unique_audio,
              COUNT(DISTINCT source_item_number) AS source_sentences,
              SUM(source_key = 'tatoeba') AS tatoeba_rows,
              SUM(audio_id IS NULL OR audio_url IS NULL OR sentence_text = '') AS invalid_audio_rows,
              SUM(status = 'active' AND (audio_license IS NULL OR audio_license = '')) AS unlicensed_active_rows,
              SUM(source_key = 'ielts-listening-core-1500') AS generated_legacy_rows
       FROM sentences`
    );
    const sentenceTotal = Number(sentenceRows[0]?.total ?? 0);
    const uniqueAudio = Number(sentenceRows[0]?.unique_audio ?? 0);
    const sourceSentences = Number(sentenceRows[0]?.source_sentences ?? 0);
    const tatoebaRows = Number(sentenceRows[0]?.tatoeba_rows ?? 0);
    const invalidAudioRows = Number(sentenceRows[0]?.invalid_audio_rows ?? 0);
    const unlicensedActiveRows = Number(sentenceRows[0]?.unlicensed_active_rows ?? 0);
    const generatedLegacyRows = Number(sentenceRows[0]?.generated_legacy_rows ?? 0);

    // Fresh databases intentionally have an empty catalog until the explicit,
    // network-backed Tatoeba import is run. Once populated, every row must be
    // one unique audio recording. Multiple recordings may share a source sentence.
    if (sentenceTotal > 0) {
      if (tatoebaRows !== sentenceTotal) throw new Error("Non-Tatoeba sentence rows remain in the catalog.");
      if (uniqueAudio !== sentenceTotal) throw new Error("Sentence catalog contains duplicate Tatoeba audio ids.");
      if (sourceSentences <= 0 || sourceSentences > sentenceTotal) {
        throw new Error("Sentence catalog has an invalid Tatoeba source-sentence count.");
      }
      if (invalidAudioRows !== 0) throw new Error(`${invalidAudioRows} sentence row(s) are missing text or audio metadata.`);
      if (unlicensedActiveRows !== 0) {
        throw new Error(`${unlicensedActiveRows} unlicensed Tatoeba audio row(s) are incorrectly marked active.`);
      }
    }
    if (generatedLegacyRows !== 0) {
      throw new Error("Generated IELTS sentence rows must be removed after the Tatoeba import.");
    }

    const [forbiddenSentenceColumnRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND COLUMN_NAME IN ('vocabulary_entry_id', 'word_id', 'answer_text')`
    );
    if (Number(forbiddenSentenceColumnRows[0]?.total ?? 0) !== 0) {
      throw new Error("Sentence catalog must not contain vocabulary-link or target-answer columns.");
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
      `Database verification passed: ${sourceItemCount} IELTS source items normalize to ${uniqueVocabularyCount} unique vocabulary entries; ` +
      (sentenceTotal
        ? `the sentence catalog contains ${sentenceTotal} unique audio recordings across ${sourceSentences} Tatoeba sentences.`
        : "the sentence catalog is empty and ready for the explicit Tatoeba import.")
    );
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Database verification failed:", error.message);
  process.exitCode = 1;
});
