import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { constants as zlibConstants, gunzip } from "node:zlib";

import { parseSentenceSource } from "../../domain/sentence-practice/SentenceCorpus.js";
import { legacyImportedSourceTemplates } from "../../domain/sentence-practice/SentenceGenericTemplates.js";
import {
  NATURAL_FALLBACK_TEMPLATES,
  TARGET,
} from "../../domain/sentence-practice/SentenceTemplateCatalog.js";
import { templatesFor } from "../../domain/sentence-practice/SentenceTemplateSelector.js";
import { loadSentenceSources } from "./SentenceSourceCatalog.js";

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

const SENTENCES_PER_SOURCE_ITEM = 3;
const MAX_SENTENCE_LENGTH = 1_000;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;
const META_SENTENCE_PATTERN = /(practical\s+example|short\s+example|example\s+using|example\s+with|clear\s+example\s+involving|lesson\s+returned\s+to|teacher\s+returned\s+to|lecturer\s+returned\s+to|mentioned.+later\s+in\s+the\s+lesson|used\s+in\s+context|reviewed\s+how.+is\s+used|as\s+a\s+description|best\s+description|naturally\s+included|useful\s+context\s+for|term.+came\s+up\s+during\s+the\s+discussion|works\s+in\s+context)/iu;

let catalogPromise;

export function validateCuratedSentenceText(value) {
  const sentence = String(value ?? "").trim();
  if (!sentence) throw new Error("Curated sentence text must not be empty.");
  if (sentence.length > MAX_SENTENCE_LENGTH) {
    throw new Error(`Curated sentence text must be at most ${MAX_SENTENCE_LENGTH} characters.`);
  }
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

function targetOccurrenceIndexes(text, needle) {
  const haystack = text.toLocaleLowerCase("en");
  const target = needle.toLocaleLowerCase("en");
  if (!target) return [];
  const indexes = [];
  let offset = 0;
  while (offset <= haystack.length - target.length) {
    const index = haystack.indexOf(target, offset);
    if (index < 0) break;
    const before = index > 0 ? text[index - 1] : "";
    const afterIndex = index + target.length;
    const after = afterIndex < text.length ? text[afterIndex] : "";
    const startsAtBoundary = !before || !WORD_CHARACTER_PATTERN.test(before);
    const endsAtBoundary = !after || !WORD_CHARACTER_PATTERN.test(after);
    if (startsAtBoundary && endsAtBoundary) indexes.push(index);
    offset = index + Math.max(1, target.length);
  }
  return indexes;
}

function instantiateTemplate(template, answerText) {
  if (template.split(TARGET).length !== 2) {
    throw new Error("Sentence templates must contain exactly one target marker.");
  }
  return template.replace(TARGET, answerText);
}

function sentenceFor({ template, answerText, variantNumber }) {
  const candidates = [
    template,
    ...NATURAL_FALLBACK_TEMPLATES.slice(variantNumber - 1),
    ...NATURAL_FALLBACK_TEMPLATES,
  ];
  for (const candidate of candidates) {
    const sentenceText = instantiateTemplate(candidate, answerText);
    if (targetOccurrenceIndexes(sentenceText, answerText).length !== 1) continue;
    if (sentenceText.length > MAX_SENTENCE_LENGTH) {
      throw new Error(
        `Generated sentence for “${answerText}” exceeds ${MAX_SENTENCE_LENGTH} characters.`
      );
    }
    return sentenceText;
  }
  throw new Error(`Could not generate an unambiguous sentence for “${answerText}”.`);
}

function legacyTemplatesFor(item) {
  try {
    return templatesFor(item);
  } catch (error) {
    if (!/Generic sentence generation for imported vocabulary books is disabled/u.test(error?.message ?? "")) {
      throw error;
    }
    const templates = legacyImportedSourceTemplates(item.category);
    if (!templates) throw error;
    return templates;
  }
}

function generatedLegacySentenceTexts(sourceText) {
  const items = parseSentenceSource(sourceText);
  const sentenceTexts = [];

  for (const item of items) {
    const templates = legacyTemplatesFor(item);
    const itemSentences = new Set();
    for (let index = 0; index < SENTENCES_PER_SOURCE_ITEM; index += 1) {
      const variantNumber = index + 1;
      let sentenceText = sentenceFor({
        template: templates[index % templates.length],
        answerText: item.answerText,
        variantNumber,
      });
      if (itemSentences.has(sentenceText)) {
        sentenceText = sentenceFor({
          template: NATURAL_FALLBACK_TEMPLATES[(index + 2) % NATURAL_FALLBACK_TEMPLATES.length],
          answerText: item.answerText,
          variantNumber,
        });
      }
      if (itemSentences.has(sentenceText)) {
        throw new Error(`Sentence variants for source item ${item.sourceItemNumber} are not unique.`);
      }
      itemSentences.add(sentenceText);
      sentenceTexts.push(sentenceText);
    }
  }

  return sentenceTexts;
}

function isCuratedSentence(sentenceText) {
  try {
    validateCuratedSentenceText(sentenceText);
    return true;
  } catch {
    return false;
  }
}

async function recoveredSentenceTexts() {
  const chunks = await Promise.all(
    CATALOG_CHUNK_URLS.map((url) => readFile(url, "utf8"))
  );
  const encodedCatalog = chunks
    .map((chunk) => chunk.replace(/\s+/gu, ""))
    .join("");
  const compressed = Buffer.from(encodedCatalog, "base64");
  const recoveredText = (
    await gunzipAsync(compressed, { finishFlush: zlibConstants.Z_SYNC_FLUSH })
  ).toString("utf8");
  const lastCompleteLine = recoveredText.lastIndexOf("\n");
  const completeText = lastCompleteLine >= 0
    ? recoveredText.slice(0, lastCompleteLine)
    : recoveredText;
  return completeText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(validateCuratedSentenceText);
}

async function buildCuratedSentenceCatalog() {
  const distinct = new Set(await recoveredSentenceTexts());
  const sources = await loadSentenceSources();

  for (const source of sources) {
    for (const sentenceText of generatedLegacySentenceTexts(source.sourceText)) {
      if (isCuratedSentence(sentenceText)) distinct.add(sentenceText);
    }
  }

  return parseCuratedSentenceCatalog([...distinct].join("\n"));
}

export async function loadCuratedSentenceCatalog() {
  catalogPromise ??= buildCuratedSentenceCatalog();
  return catalogPromise;
}
