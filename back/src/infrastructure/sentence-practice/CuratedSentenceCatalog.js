import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { constants as zlibConstants, gunzip } from "node:zlib";

const gunzipAsync = promisify(gunzip);
const CATALOG_CHUNK_URLS = Array.from(
  { length: 5 },
  (_, index) => new URL(
    `../../../data/sentence-catalog-v2.b64/part-${String(index + 1).padStart(2, "0")}.txt`,
    import.meta.url
  )
);

export const CURATED_SENTENCE_CATALOG_VERSION = "2026-09-03.2";
export const EXPECTED_CURATED_SENTENCE_COUNT = 5_781;

const META_SENTENCE_PATTERN = /(practical\s+example|short\s+example|example\s+using|example\s+with|clear\s+example\s+involving|lesson\s+returned\s+to|teacher\s+returned\s+to|lecturer\s+returned\s+to|mentioned.+later\s+in\s+the\s+lesson|used\s+in\s+context|reviewed\s+how.+is\s+used|as\s+a\s+description|best\s+description|naturally\s+included|useful\s+context\s+for|term.+came\s+up\s+during\s+the\s+discussion|works\s+in\s+context)/iu;

export function validateCuratedSentenceText(value) {
  const sentence = String(value ?? "").trim();
  if (!sentence) throw new Error("Curated sentence text must not be empty.");
  if (sentence.length > 1_000) throw new Error("Curated sentence text must be at most 1000 characters.");
  if (/["“”]/u.test(sentence)) {
    throw new Error(`Curated sentence must use the target naturally, not as a quoted label: ${sentence}`);
  }
  if (META_SENTENCE_PATTERN.test(sentence)) {
    throw new Error(`Curated sentence contains a metalinguistic/generic practice template: ${sentence}`);
  }
  if (!/[.!?]$/u.test(sentence)) {
    throw new Error(`Curated sentence must end with punctuation: ${sentence}`);
  }
  return sentence;
}

export function parseCuratedSentenceCatalog(text) {
  if (typeof text !== "string") throw new Error("Curated sentence catalog must be UTF-8 text.");
  const sentences = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(validateCuratedSentenceText);

  if (sentences.length !== EXPECTED_CURATED_SENTENCE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CURATED_SENTENCE_COUNT} curated sentences; found ${sentences.length}.`
    );
  }
  if (new Set(sentences).size !== sentences.length) {
    throw new Error("Curated sentence catalog contains duplicate sentence text.");
  }
  return sentences;
}

export async function loadCuratedSentenceCatalog() {
  const chunks = await Promise.all(
    CATALOG_CHUNK_URLS.map((url) => readFile(url, "utf8"))
  );
  const encodedCatalog = chunks
    .map((chunk) => chunk.replace(/\s+/gu, ""))
    .join("");
  const compressed = Buffer.from(encodedCatalog, "base64");
  const text = (
    await gunzipAsync(compressed, { finishFlush: zlibConstants.Z_SYNC_FLUSH })
  ).toString("utf8");
  return parseCuratedSentenceCatalog(text);
}
