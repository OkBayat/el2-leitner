import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import {
  TATOEBA_AUDIO_URL,
  TATOEBA_MINIMUM_ENGLISH_AUDIO_SENTENCES,
  TATOEBA_SENTENCES_URL,
  isReusableTatoebaAudio,
  parseTatoebaAudioLine,
  parseTatoebaSentenceLine,
  pickPreferredTatoebaAudio,
  tatoebaAudioDownloadUrl,
} from "../src/infrastructure/tatoeba/TatoebaExport.js";

const IMPORT_TABLE = "sentences_tatoeba_import";
const PREVIOUS_TABLE = "sentences_tatoeba_previous";
const AUDIO_STAGE_TABLE = "tatoeba_audio_import_stage";
const IMPORT_LOCK = "vocora:tatoeba-sentence-import";
const AUDIO_BATCH_SIZE = 1_000;
const SENTENCE_BATCH_SIZE = 500;

for (const environmentFile of [
  new URL("../.env", import.meta.url),
  new URL("../../.env", import.meta.url),
]) {
  loadEnvironment({ path: fileURLToPath(environmentFile), quiet: true });
}

function option(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function required(name, fallbackName) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}${fallbackName ? ` (or ${fallbackName})` : ""}`);
  }
  return value;
}

async function download(url, destination) {
  console.info(`Downloading ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Tatoeba download failed (${response.status} ${response.statusText}): ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  console.info(`Saved ${destination}`);
}

function findBzipCommand() {
  const candidates = [
    ["bzip2", ["-dc"]],
    ["bunzip2", ["-c"]],
  ];
  for (const [command, args] of candidates) {
    const probe = spawnSync(command, ["--help"], { stdio: "ignore" });
    if (!probe.error) return { command, args };
  }
  throw new Error(
    "A bzip2 decompressor is required. Install bzip2/bunzip2, or run the importer inside the Vocora backend container."
  );
}

async function* linesFrom(filePath) {
  let input;
  let child = null;
  let childExit = null;
  let childStderr = "";
  if (filePath.endsWith(".bz2")) {
    const { command, args } = findBzipCommand();
    child = spawn(command, [...args, filePath], { stdio: ["ignore", "pipe", "pipe"] });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { childStderr += chunk; });
    childExit = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    input = child.stdout;
  } else {
    input = createReadStream(filePath);
  }

  const reader = createInterface({ input, crlfDelay: Infinity });
  let completed = false;
  try {
    for await (const line of reader) {
      if (line) yield line;
    }
    completed = true;
  } finally {
    reader.close();
    if (!completed && child && !child.killed) child.kill();
  }

  if (childExit) {
    const code = await childExit;
    if (code !== 0) {
      throw new Error(`bzip2 failed for ${filePath}: ${childStderr.trim() || `exit ${code}`}`);
    }
  }
}

async function insertAudioBatch(connection, rows) {
  if (!rows.length) return;
  const placeholders = rows.map(() => "(?,?,?,?,?)").join(",");
  const values = rows.flatMap((row) => [
    row.sentenceId,
    row.audioId,
    row.contributor,
    row.license,
    row.attributionUrl,
  ]);
  await connection.execute(
    `INSERT INTO ${AUDIO_STAGE_TABLE}
       (sentence_id, audio_id, contributor, audio_license, attribution_url)
     VALUES ${placeholders}`,
    values
  );
}

async function stageAudioExport(connection, audioFile) {
  let batch = [];
  let recordings = 0;
  for await (const line of linesFrom(audioFile)) {
    batch.push(parseTatoebaAudioLine(line));
    recordings += 1;
    if (batch.length >= AUDIO_BATCH_SIZE) {
      await insertAudioBatch(connection, batch);
      batch = [];
    }
    if (recordings % 100_000 === 0) console.info(`Staged ${recordings.toLocaleString("en-US")} audio recordings…`);
  }
  await insertAudioBatch(connection, batch);

  const [rows] = await connection.query(
    `SELECT COUNT(*) AS recordings, COUNT(DISTINCT sentence_id) AS sentences
     FROM ${AUDIO_STAGE_TABLE}`
  );
  return {
    recordings: Number(rows[0].recordings),
    sentences: Number(rows[0].sentences),
  };
}

async function audioForSentenceBatch(connection, sentenceIds) {
  if (!sentenceIds.length) return new Map();
  const placeholders = sentenceIds.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `SELECT sentence_id, audio_id, contributor, audio_license, attribution_url
     FROM ${AUDIO_STAGE_TABLE}
     WHERE sentence_id IN (${placeholders})
     ORDER BY sentence_id, audio_id`,
    sentenceIds
  );

  const best = new Map();
  for (const row of rows) {
    const candidate = {
      sentenceId: Number(row.sentence_id),
      audioId: Number(row.audio_id),
      contributor: row.contributor === null ? null : String(row.contributor),
      license: row.audio_license === null ? null : String(row.audio_license),
      attributionUrl: row.attribution_url === null ? null : String(row.attribution_url),
    };
    best.set(candidate.sentenceId, pickPreferredTatoebaAudio(best.get(candidate.sentenceId), candidate));
  }
  return best;
}

async function insertSentenceBatch(connection, sentenceRows) {
  if (!sentenceRows.length) return 0;
  const ids = sentenceRows.map((row) => row.sentenceId);
  const audioBySentence = await audioForSentenceBatch(connection, ids);
  const importRows = [];

  for (const sentence of sentenceRows) {
    const audio = audioBySentence.get(sentence.sentenceId);
    if (!audio) continue;
    importRows.push([
      "en",
      "tatoeba",
      sentence.sentenceId,
      1,
      "Tatoeba",
      sentence.text,
      audio.audioId,
      tatoebaAudioDownloadUrl(audio.audioId),
      audio.contributor,
      audio.license,
      audio.attributionUrl,
      isReusableTatoebaAudio(audio) ? "active" : "restricted",
    ]);
  }

  if (!importRows.length) return 0;
  const placeholders = importRows.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
  await connection.execute(
    `INSERT INTO ${IMPORT_TABLE}
       (language_code, source_key, source_item_number, variant_number, category, sentence_text,
        audio_id, audio_url, audio_contributor, audio_license, audio_attribution_url, status)
     VALUES ${placeholders}`,
    importRows.flat()
  );
  return importRows.length;
}

async function importSentences(connection, sentencesFile) {
  let batch = [];
  let scanned = 0;
  let imported = 0;
  for await (const line of linesFrom(sentencesFile)) {
    const sentence = parseTatoebaSentenceLine(line);
    if (sentence.languageCode !== "eng") continue;
    batch.push(sentence);
    scanned += 1;
    if (batch.length >= SENTENCE_BATCH_SIZE) {
      imported += await insertSentenceBatch(connection, batch);
      batch = [];
    }
    if (scanned % 250_000 === 0) {
      console.info(
        `Scanned ${scanned.toLocaleString("en-US")} English sentences; imported ${imported.toLocaleString("en-US")} audio sentences…`
      );
    }
  }
  imported += await insertSentenceBatch(connection, batch);
  return { scanned, imported };
}

async function validateImport(connection, { minimumCount, expectedCount, audioSentenceCount }) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT source_item_number) AS source_sentences,
            SUM(status = 'active') AS playable,
            SUM(status = 'restricted') AS restricted,
            SUM(audio_id IS NULL OR audio_url IS NULL OR sentence_text = '') AS invalid
     FROM ${IMPORT_TABLE}`
  );
  const result = {
    total: Number(rows[0].total),
    sourceSentences: Number(rows[0].source_sentences),
    playable: Number(rows[0].playable ?? 0),
    restricted: Number(rows[0].restricted ?? 0),
    invalid: Number(rows[0].invalid ?? 0),
  };

  if (result.invalid !== 0) throw new Error(`Import contains ${result.invalid} row(s) without text/audio.`);
  if (result.total !== result.sourceSentences) throw new Error("Tatoeba import contains duplicate sentence rows.");
  if (result.total !== audioSentenceCount) {
    throw new Error(
      `Audio export references ${audioSentenceCount} unique English sentences, but ${result.total} sentence rows were imported.`
    );
  }
  if (result.total < minimumCount) {
    throw new Error(
      `Refusing to replace the sentence catalog: expected at least ${minimumCount} English audio sentences, found ${result.total}.`
    );
  }
  if (expectedCount !== null && result.total !== expectedCount) {
    throw new Error(`Expected exactly ${expectedCount} English audio sentences, found ${result.total}.`);
  }
  return result;
}

async function main() {
  const minimumCount = positiveInteger(
    option("minimum-count"),
    TATOEBA_MINIMUM_ENGLISH_AUDIO_SENTENCES,
    "--minimum-count"
  );
  const expectedValue = option("expected-count");
  const expectedCount = expectedValue === undefined
    ? null
    : positiveInteger(expectedValue, undefined, "--expected-count");
  const providedSentencesFile = option("sentences-file");
  const providedAudioFile = option("audio-file");
  if (Boolean(providedSentencesFile) !== Boolean(providedAudioFile)) {
    throw new Error("Use --sentences-file and --audio-file together, or omit both to download the latest exports.");
  }

  const workspace = await mkdtemp(path.join(tmpdir(), "vocora-tatoeba-"));
  const downloaded = !providedSentencesFile;
  const sentencesFile = providedSentencesFile || path.join(workspace, "eng_sentences.tsv.bz2");
  const audioFile = providedAudioFile || path.join(workspace, "eng_sentences_with_audio.tsv.bz2");
  const keepDownloads = process.argv.includes("--keep-downloads");

  if (downloaded) {
    await download(process.env.TATOEBA_SENTENCES_URL || TATOEBA_SENTENCES_URL, sentencesFile);
    await download(process.env.TATOEBA_AUDIO_URL || TATOEBA_AUDIO_URL, audioFile);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: required("DB_ADMIN_USER", "DB_USER"),
    password: required("DB_ADMIN_PASSWORD", "DB_PASSWORD"),
    database: required("DB_NAME"),
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  let lockAcquired = false;
  let swapped = false;
  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK(?, 0) AS acquired", [IMPORT_LOCK]);
    lockAcquired = Number(lockRows[0].acquired) === 1;
    if (!lockAcquired) throw new Error("Another Tatoeba sentence import is already running.");

    await connection.query(`DROP TABLE IF EXISTS ${IMPORT_TABLE}`);
    await connection.query(`DROP TABLE IF EXISTS ${PREVIOUS_TABLE}`);
    await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${AUDIO_STAGE_TABLE}`);
    await connection.query(`CREATE TABLE ${IMPORT_TABLE} LIKE sentences`);
    await connection.query(
      `CREATE TEMPORARY TABLE ${AUDIO_STAGE_TABLE} (
         audio_id BIGINT UNSIGNED NOT NULL,
         sentence_id BIGINT UNSIGNED NOT NULL,
         contributor VARCHAR(255) NULL,
         audio_license VARCHAR(128) NULL,
         attribution_url VARCHAR(1000) NULL,
         PRIMARY KEY (audio_id),
         KEY tatoeba_audio_sentence_index (sentence_id)
       ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci`
    );

    const audio = await stageAudioExport(connection, audioFile);
    console.info(
      `Audio export: ${audio.recordings.toLocaleString("en-US")} recordings for ${audio.sentences.toLocaleString("en-US")} unique English sentences.`
    );
    const sentenceImport = await importSentences(connection, sentencesFile);
    const validated = await validateImport(connection, {
      minimumCount,
      expectedCount,
      audioSentenceCount: audio.sentences,
    });

    console.info(
      `Validated ${validated.total.toLocaleString("en-US")} unique Tatoeba sentences: ` +
      `${validated.playable.toLocaleString("en-US")} playable, ${validated.restricted.toLocaleString("en-US")} restricted by missing audio license.`
    );
    console.info(`Scanned ${sentenceImport.scanned.toLocaleString("en-US")} English sentence rows.`);

    await connection.query(
      `RENAME TABLE sentences TO ${PREVIOUS_TABLE}, ${IMPORT_TABLE} TO sentences`
    );
    swapped = true;
    await connection.query(`DROP TABLE ${PREVIOUS_TABLE}`);
    console.info(
      `Tatoeba import complete. The previous audio-less sentence catalog was removed; sentences now contains ${validated.total.toLocaleString("en-US")} audio-backed rows.`
    );
  } finally {
    try {
      await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${AUDIO_STAGE_TABLE}`);
      if (!swapped) await connection.query(`DROP TABLE IF EXISTS ${IMPORT_TABLE}`);
      if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [IMPORT_LOCK]);
    } finally {
      await connection.end();
      if (downloaded && !keepDownloads) await rm(workspace, { recursive: true, force: true });
      else if (downloaded) console.info(`Kept downloaded exports in ${workspace}`);
      else await rm(workspace, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error("Tatoeba sentence import failed:", error.message);
  process.exitCode = 1;
});
