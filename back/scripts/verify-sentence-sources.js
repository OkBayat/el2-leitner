import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import {
  EXPECTED_CURATED_SENTENCE_COUNT,
  loadCuratedSentenceCatalog,
} from "../src/infrastructure/sentence-practice/CuratedSentenceCatalog.js";

loadEnvironment({ path: new URL("../.env", import.meta.url), quiet: true });
loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
    const expected = await loadCuratedSentenceCatalog();
    const [rows] = await pool.execute(
      `SELECT sentence_text
       FROM sentences
       WHERE status = 'active'`
    );
    const activeTexts = new Set(rows.map((row) => String(row.sentence_text)));
    const missing = expected.filter((sentenceText) => !activeTexts.has(sentenceText));
    if (missing.length) {
      throw new Error(
        `Sentence catalog is missing ${missing.length} curated sentence(s); first missing sentence: ${missing[0]}`
      );
    }

    // The strict quoted-target / generic-template rules apply to the curated independent
    // sentence corpus. Collection-managed examples are separately linked through
    // sentence_vocabulary_entries and may legitimately contain dialogue punctuation.
    const [unsafeRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM sentences s
       WHERE s.status = 'active'
         AND NOT EXISTS (
           SELECT 1
           FROM sentence_vocabulary_entries sve
           WHERE sve.sentence_id = s.id
         )
         AND (
           LOCATE(CHAR(34), s.sentence_text) > 0
           OR LOCATE(CONVERT(0xE2809C USING utf8mb4), s.sentence_text) > 0
           OR LOCATE(CONVERT(0xE2809D USING utf8mb4), s.sentence_text) > 0
           OR s.sentence_text LIKE 'The discussion included useful information about %'
           OR REGEXP_LIKE(
             s.sentence_text,
             '(practical[[:space:]]+example|short[[:space:]]+example|example[[:space:]]+using|example[[:space:]]+with|clear[[:space:]]+example[[:space:]]+involving|lesson[[:space:]]+returned[[:space:]]+to|teacher[[:space:]]+returned[[:space:]]+to|lecturer[[:space:]]+returned[[:space:]]+to|mentioned.+later[[:space:]]+in[[:space:]]+the[[:space:]]+lesson|used[[:space:]]+in[[:space:]]+context|reviewed[[:space:]]+how.+is[[:space:]]+used|as[[:space:]]+a[[:space:]]+description|best[[:space:]]+description|naturally[[:space:]]+included|useful[[:space:]]+context[[:space:]]+for|term.+came[[:space:]]+up[[:space:]]+during[[:space:]]+the[[:space:]]+discussion|works[[:space:]]+in[[:space:]]+context)',
             'i'
           )
         )`
    );
    if (Number(unsafeRows[0]?.total ?? 0) !== 0) {
      throw new Error("Curated sentence catalog contains quoted targets or rejected generic/metalinguistic templates.");
    }

    const [forbiddenRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND COLUMN_NAME IN (
           'language_code', 'source_key', 'source_item_number',
           'variant_number', 'category', 'source_hash',
           'vocabulary_entry_id', 'word_id', 'answer_text'
         )`
    );
    if (Number(forbiddenRows[0]?.total ?? 0) !== 0) {
      throw new Error("Sentence catalog contains deprecated provenance or vocabulary-link columns.");
    }

    console.info(
      `Curated sentence verification passed: ${EXPECTED_CURATED_SENTENCE_COUNT} natural seed sentences are active and no rejected templates remain.`
    );
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Curated sentence verification failed:", error.message);
  process.exitCode = 1;
});
