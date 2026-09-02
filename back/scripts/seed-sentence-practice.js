import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import {
  EXPECTED_SENTENCE_SOURCE_ITEMS,
  SENTENCES_PER_SOURCE_ITEM,
  buildSentenceCorpus,
} from "../src/domain/sentence-practice/SentenceCorpus.js";
import { seedSentencePractice } from "../src/infrastructure/persistence/mysql/seedSentencePractice.js";

const IELTS_SOURCE = new URL("../../ui/data/IELTS_Listening_Core_1500.md", import.meta.url);
const dryRun = process.argv.includes("--dry-run");

for (const environmentFile of [
  new URL("../.env", import.meta.url),
  new URL("../../.env", import.meta.url),
]) {
  loadEnvironment({ path: fileURLToPath(environmentFile), quiet: true });
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const sourceText = await readFile(IELTS_SOURCE, "utf8");
  if (dryRun) {
    const corpus = buildSentenceCorpus(sourceText);
    const expectedSentences = EXPECTED_SENTENCE_SOURCE_ITEMS * SENTENCES_PER_SOURCE_ITEM;
    if (corpus.sourceItemCount !== EXPECTED_SENTENCE_SOURCE_ITEMS || corpus.sentenceCount !== expectedSentences) {
      throw new Error(
        `Expected ${EXPECTED_SENTENCE_SOURCE_ITEMS} source items and ${expectedSentences} sentences; generated ${corpus.sourceItemCount} and ${corpus.sentenceCount}.`
      );
    }
    console.info(
      `Sentence corpus is valid: ${corpus.sourceItemCount} source items produce ${corpus.sentenceCount} sentence variants.`
    );
    return;
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 4),
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  try {
    const result = await seedSentencePractice({ pool, sourceText });
    console.info(
      `${result.changed ? "Seeded" : "Verified"} ${result.sentenceCount} sentence variants for ${result.sourceItemCount} source items.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Sentence-practice seed failed:", error.message);
  process.exitCode = 1;
});
