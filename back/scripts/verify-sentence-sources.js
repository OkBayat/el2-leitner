import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import { SENTENCES_PER_SOURCE_ITEM } from "../src/domain/sentence-practice/SentenceCorpus.js";
import { SENTENCE_SOURCE_DEFINITIONS } from "../src/infrastructure/sentence-practice/SentenceSourceCatalog.js";

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
    let totalItems = 0;
    let totalSentences = 0;
    for (const source of SENTENCE_SOURCE_DEFINITIONS) {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total,
                COUNT(DISTINCT source_item_number) AS source_items,
                COUNT(DISTINCT source_hash) AS source_hashes
         FROM sentences
         WHERE source_key = ? AND status = 'active'`,
        [source.key]
      );
      const expectedSentences = source.expectedSourceItems * SENTENCES_PER_SOURCE_ITEM;
      const actualSentences = Number(rows[0]?.total ?? 0);
      const actualItems = Number(rows[0]?.source_items ?? 0);
      const sourceHashes = Number(rows[0]?.source_hashes ?? 0);
      if (actualSentences !== expectedSentences || actualItems !== source.expectedSourceItems || sourceHashes !== 1) {
        throw new Error(
          `${source.key}: expected ${source.expectedSourceItems} items/${expectedSentences} sentences/1 hash; found ${actualItems}/${actualSentences}/${sourceHashes}.`
        );
      }

      const [invalidRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM (
           SELECT source_item_number
           FROM sentences
           WHERE source_key = ? AND status = 'active'
           GROUP BY source_item_number
           HAVING COUNT(*) <> ? OR COUNT(DISTINCT variant_number) <> ?
         ) invalid_source_items`,
        [source.key, SENTENCES_PER_SOURCE_ITEM, SENTENCES_PER_SOURCE_ITEM]
      );
      if (Number(invalidRows[0]?.total ?? 0) !== 0) {
        throw new Error(`${source.key}: at least one source item does not have exactly three variants.`);
      }
      totalItems += actualItems;
      totalSentences += actualSentences;
    }

    const [forbiddenRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sentences'
         AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    if (Number(forbiddenRows[0]?.total ?? 0) !== 0) {
      throw new Error("Sentence catalog must remain independent and contain no foreign keys.");
    }

    console.info(`Sentence-source verification passed: ${totalItems} source items -> ${totalSentences} independent sentences.`);
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Sentence-source verification failed:", error.message);
  process.exitCode = 1;
});
