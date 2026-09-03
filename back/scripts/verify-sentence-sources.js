import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import { SENTENCES_PER_SOURCE_ITEM, buildSentenceCorpus } from "../src/domain/sentence-practice/SentenceCorpus.js";
import { loadSentenceSources } from "../src/infrastructure/sentence-practice/SentenceSourceCatalog.js";

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
    const sources = await loadSentenceSources();
    const expectedTexts = new Set();
    let totalItems = 0;
    let generatedSentences = 0;

    for (const source of sources) {
      const corpus = buildSentenceCorpus(source.sourceText);
      const expectedSentences = source.expectedSourceItems * SENTENCES_PER_SOURCE_ITEM;
      if (corpus.sourceItemCount !== source.expectedSourceItems || corpus.sentenceCount !== expectedSentences) {
        throw new Error(
          `${source.key}: expected ${source.expectedSourceItems} items/${expectedSentences} sentences; generated ${corpus.sourceItemCount}/${corpus.sentenceCount}.`
        );
      }
      totalItems += corpus.sourceItemCount;
      generatedSentences += corpus.sentenceCount;
      for (const record of corpus.records) expectedTexts.add(record.sentenceText);
    }

    const [rows] = await pool.execute(
      `SELECT sentence_text
       FROM sentences
       WHERE status = 'active'`
    );
    const activeTexts = new Set(rows.map((row) => String(row.sentence_text)));
    const missing = [...expectedTexts].filter((sentenceText) => !activeTexts.has(sentenceText));
    if (missing.length) {
      throw new Error(
        `Sentence catalog is missing ${missing.length} generated sentence(s); first missing sentence: ${missing[0]}`
      );
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
      `Sentence-source verification passed: ${totalItems} source items -> ${generatedSentences} generated variants -> ${expectedTexts.size} distinct active sentence texts.`
    );
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Sentence-source verification failed:", error.message);
  process.exitCode = 1;
});
