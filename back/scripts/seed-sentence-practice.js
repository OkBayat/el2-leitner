import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import {
  CURATED_SENTENCE_CATALOG_VERSION,
  EXPECTED_CURATED_SENTENCE_COUNT,
  loadCuratedSentenceCatalog,
} from "../src/infrastructure/sentence-practice/CuratedSentenceCatalog.js";
import { seedSentenceCatalog } from "../src/infrastructure/persistence/mysql/seedSentencePractice.js";

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
  const sentences = await loadCuratedSentenceCatalog();
  if (dryRun) {
    console.info(
      `Curated sentence catalog ${CURATED_SENTENCE_CATALOG_VERSION} is valid: ${sentences.length} natural sentences.`
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
    const result = await seedSentenceCatalog({ pool, sentences });
    if (result.sentenceCount !== EXPECTED_CURATED_SENTENCE_COUNT) {
      throw new Error(
        `Expected ${EXPECTED_CURATED_SENTENCE_COUNT} curated sentences; seed reported ${result.sentenceCount}.`
      );
    }
    console.info(
      `${result.changed ? "Seeded" : "Verified"} curated sentence catalog ${CURATED_SENTENCE_CATALOG_VERSION}: `
      + `${result.sentenceCount} sentences (${result.insertedCount} inserted).`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Sentence-practice seed failed:", error.message);
  process.exitCode = 1;
});
