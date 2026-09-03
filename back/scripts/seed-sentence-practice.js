import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import { SENTENCES_PER_SOURCE_ITEM, buildSentenceCorpus } from "../src/domain/sentence-practice/SentenceCorpus.js";
import { loadSentenceSources } from "../src/infrastructure/sentence-practice/SentenceSourceCatalog.js";
import { seedSentenceSources } from "../src/infrastructure/persistence/mysql/seedSentencePractice.js";

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
  const sources = await loadSentenceSources();
  if (dryRun) {
    let totalItems = 0;
    let totalSentences = 0;
    for (const source of sources) {
      const corpus = buildSentenceCorpus(source.sourceText);
      const expectedSentences = source.expectedSourceItems * SENTENCES_PER_SOURCE_ITEM;
      if (corpus.sourceItemCount !== source.expectedSourceItems || corpus.sentenceCount !== expectedSentences) {
        throw new Error(
          `${source.key}: expected ${source.expectedSourceItems} source items and ${expectedSentences} sentences; generated ${corpus.sourceItemCount} and ${corpus.sentenceCount}.`
        );
      }
      totalItems += corpus.sourceItemCount;
      totalSentences += corpus.sentenceCount;
      console.info(`${source.label}: ${corpus.sourceItemCount} items -> ${corpus.sentenceCount} sentences.`);
    }
    console.info(`Sentence catalog is valid: ${totalItems} source items -> ${totalSentences} sentence variants.`);
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
    const result = await seedSentenceSources({ pool, sources });
    for (const sourceResult of result.results) {
      console.info(
        `${sourceResult.changed ? "Seeded" : "Verified"} ${sourceResult.sentenceCount} sentence variants for ${sourceResult.sourceItemCount} items from ${sourceResult.sourceKey}.`
      );
    }
    console.info(`Sentence catalog total: ${result.sourceItemCount} source items, ${result.sentenceCount} sentence variants.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Sentence-practice seed failed:", error.message);
  process.exitCode = 1;
});
