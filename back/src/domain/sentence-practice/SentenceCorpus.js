import { ValidationError } from "../errors.js";
import { cleanVocabularyForms, normalizeVocabularyForm } from "../library/VocabularyNormalizer.js";
import { NATURAL_FALLBACK_TEMPLATES, TARGET } from "./SentenceTemplateCatalog.js";
import { templatesFor } from "./SentenceTemplateSelector.js";

export const SENTENCE_CORPUS_SOURCE = "ielts-listening-core-1500";
export const SENTENCE_CORPUS_VERSION = "2026-09-02.4";
export const SENTENCES_PER_SOURCE_ITEM = 3;
export const EXPECTED_SENTENCE_SOURCE_ITEMS = 1_500;

const MAX_SENTENCE_LENGTH = 1_000;

const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

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
    if ([`“${answerText}”`, `"${answerText}"`, `'${answerText}'`].some((quoted) => sentenceText.includes(quoted))) {
      continue;
    }
    if (sentenceText.length > MAX_SENTENCE_LENGTH) {
      throw new ValidationError(
        "SENTENCE_TOO_LONG",
        `Generated sentence for “${answerText}” exceeds ${MAX_SENTENCE_LENGTH} characters.`
      );
    }
    return sentenceText;
  }
  throw new Error(`Could not generate an unambiguous sentence for “${answerText}”.`);
}

export function parseSentenceSource(sourceText) {
  if (typeof sourceText !== "string") {
    throw new ValidationError("INVALID_SENTENCE_SOURCE", "Sentence source must be plain text.");
  }

  const sectionStack = [];
  const items = [];
  const seenNumbers = new Set();

  for (const rawLine of sourceText.split(/\r?\n/u)) {
    const heading = rawLine.match(/^\s*(#{2,6})\s+(.+?)\s*$/u);
    if (heading) {
      const depth = heading[1].length - 2;
      sectionStack.splice(depth);
      sectionStack[depth] = heading[2].trim();
      continue;
    }

    const numbered = rawLine.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/u);
    if (!numbered) continue;
    const sourceItemNumber = Number(numbered[1]);
    if (!Number.isSafeInteger(sourceItemNumber) || sourceItemNumber <= 0 || seenNumbers.has(sourceItemNumber)) {
      throw new ValidationError(
        "INVALID_SENTENCE_SOURCE_NUMBER",
        `Sentence source item number ${numbered[1]} is invalid or duplicated.`
      );
    }
    seenNumbers.add(sourceItemNumber);

    const rawForms = numbered[2].split(/\s+\/\s+/u).map((value) => value.trim()).filter(Boolean);
    const forms = cleanVocabularyForms(rawForms[0], rawForms.slice(1));
    const category = sectionStack.filter(Boolean).join(" / ") || "Uncategorized";
    items.push({
      sourceItemNumber,
      category,
      answerText: forms[0].form,
      acceptedForms: forms.map(({ form }) => form),
      normalizedForms: forms.map(({ form }) => normalizeVocabularyForm(form)),
    });
  }

  if (!items.length) {
    throw new ValidationError("EMPTY_SENTENCE_SOURCE", "No numbered vocabulary items were found for sentence practice.");
  }
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].sourceItemNumber !== index + 1) {
      throw new ValidationError(
        "NON_SEQUENTIAL_SENTENCE_SOURCE",
        `Sentence source numbering must be continuous from 1; expected ${index + 1}, found ${items[index].sourceItemNumber}.`
      );
    }
  }
  return items;
}

export function buildSentenceCorpus(sourceText) {
  const items = parseSentenceSource(sourceText);
  const records = [];

  for (const item of items) {
    const templates = templatesFor(item);
    const sentenceTexts = new Set();
    for (let index = 0; index < SENTENCES_PER_SOURCE_ITEM; index += 1) {
      const variantNumber = index + 1;
      let sentenceText = sentenceFor({
        template: templates[index % templates.length],
        answerText: item.answerText,
        variantNumber,
      });
      if (sentenceTexts.has(sentenceText)) {
        sentenceText = sentenceFor({
          template: NATURAL_FALLBACK_TEMPLATES[(index + 2) % NATURAL_FALLBACK_TEMPLATES.length],
          answerText: item.answerText,
          variantNumber,
        });
      }
      if (sentenceTexts.has(sentenceText)) {
        throw new Error(`Sentence variants for source item ${item.sourceItemNumber} are not unique.`);
      }
      sentenceTexts.add(sentenceText);
      records.push({ ...item, variantNumber, sentenceText });
    }
  }

  return {
    sourceItemCount: items.length,
    sentenceCount: records.length,
    records,
  };
}

export function splitSentenceAtAnswer(sentenceText, answerText) {
  const indexes = targetOccurrenceIndexes(sentenceText, answerText);
  if (indexes.length !== 1) {
    throw new Error(`Sentence must contain the answer “${answerText}” exactly once as a complete term.`);
  }
  const start = indexes[0];
  return {
    before: sentenceText.slice(0, start),
    after: sentenceText.slice(start + answerText.length),
  };
}
