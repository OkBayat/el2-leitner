import { parseSentenceSource } from "../../domain/sentence-practice/SentenceCorpus.js";
import { naturalImportedSourceTemplates } from "../../domain/sentence-practice/SentenceGenericTemplates.js";
import {
  NATURAL_FALLBACK_TEMPLATES,
  TARGET,
} from "../../domain/sentence-practice/SentenceTemplateCatalog.js";
import { templatesFor } from "../../domain/sentence-practice/SentenceTemplateSelector.js";
import { loadSentenceSources } from "./SentenceSourceCatalog.js";

export const CURATED_SENTENCE_CATALOG_VERSION = "2026-09-03.3";
export const EXPECTED_CURATED_SENTENCE_COUNT = 5_781;

const SENTENCES_PER_SOURCE_ITEM = 3;
const MAX_SENTENCE_LENGTH = 1_000;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;
const IMPORTED_GENERIC_DISABLED_PATTERN = /Generic sentence generation for imported vocabulary books is disabled/u;
const META_SENTENCE_PATTERN = /(discussion\s+included\s+useful\s+information\s+about|practical\s+example|short\s+example|example\s+using|example\s+with|clear\s+example\s+involving|lesson\s+returned\s+to|teacher\s+returned\s+to|lecturer\s+returned\s+to|mentioned.+later\s+in\s+the\s+lesson|used\s+in\s+context|reviewed\s+how.+is\s+used|as\s+a\s+description|best\s+description|naturally\s+included|useful\s+context\s+for|term.+came\s+up\s+during\s+the\s+discussion|works\s+in\s+context)/iu;
const REQUIRED_CURATED_SENTENCES = [
  "Please install the software before the meeting.",
  "It is easy to get into debt if you spend more than you earn.",
  "Many people get into debt when they rely too much on credit cards.",
  "Students can get into debt if they borrow more money than they can repay.",
];

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

function isCuratedSentence(sentenceText) {
  try {
    validateCuratedSentenceText(sentenceText);
    return true;
  } catch {
    return false;
  }
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

function sentenceVariants(item, templates, { validate = true } = {}) {
  const variants = [];
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
    if (validate) validateCuratedSentenceText(sentenceText);
    itemSentences.add(sentenceText);
    variants.push(sentenceText);
  }
  return variants;
}

async function buildCuratedSentenceCatalog() {
  const sources = await loadSentenceSources();
  const distinct = new Set(REQUIRED_CURATED_SENTENCES.map(validateCuratedSentenceText));
  const missingImportedItems = [];

  for (const source of sources) {
    for (const item of parseSentenceSource(source.sourceText)) {
      try {
        const variants = sentenceVariants(item, templatesFor(item), { validate: false });
        for (const sentenceText of variants) {
          if (isCuratedSentence(sentenceText)) distinct.add(sentenceText);
        }
      } catch (error) {
        if (!IMPORTED_GENERIC_DISABLED_PATTERN.test(error?.message ?? "")) throw error;
        missingImportedItems.push(item);
      }
    }
  }

  const replacementVariants = missingImportedItems.map((item) => {
    const templates = naturalImportedSourceTemplates(item.category, item.answerText);
    if (!templates) {
      throw new Error(`No natural imported sentence templates for category “${item.category}”.`);
    }
    return sentenceVariants(item, templates);
  });

  for (let variantIndex = 0; variantIndex < SENTENCES_PER_SOURCE_ITEM; variantIndex += 1) {
    for (const variants of replacementVariants) {
      if (distinct.size >= EXPECTED_CURATED_SENTENCE_COUNT) break;
      distinct.add(variants[variantIndex]);
    }
    if (distinct.size >= EXPECTED_CURATED_SENTENCE_COUNT) break;
  }

  return parseCuratedSentenceCatalog([...distinct].join("\n"));
}

export async function loadCuratedSentenceCatalog() {
  catalogPromise ??= buildCuratedSentenceCatalog();
  return catalogPromise;
}
