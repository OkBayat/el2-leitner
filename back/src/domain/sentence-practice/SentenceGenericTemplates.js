import { TARGET } from "./SentenceTemplateCatalog.js";

const FREQUENCY_ADVERBS = new Set([
  "always",
  "usually",
  "often",
  "sometimes",
  "occasionally",
  "rarely",
  "seldom",
  "never",
]);

const DEGREE_ADVERBS = new Set([
  "absolutely",
  "almost",
  "completely",
  "extremely",
  "fairly",
  "highly",
  "nearly",
  "quite",
  "rather",
  "really",
  "so",
  "too",
  "totally",
  "very",
]);

function categoryParts(category) {
  return String(category || "")
    .split(" / ")
    .map((value) => value.trim())
    .filter(Boolean);
}

function importedBookParts(category) {
  const parts = categoryParts(category);
  if (!parts.length) return null;
  const root = parts[0];
  if (!/^(unit\s+\d+|file\s+\d+)/iu.test(root)) return null;
  return { leaf: parts.at(-1).toLocaleLowerCase("en") };
}

export function naturalImportedSourceTemplates(category, answerText = "") {
  const imported = importedBookParts(category);
  if (!imported) return null;
  const { leaf } = imported;
  const normalizedAnswer = String(answerText).trim().toLocaleLowerCase("en");

  if (["nouns", "compound nouns"].includes(leaf)) {
    return [
      `The ${TARGET} played an important role in the decision.`,
      `They discussed the ${TARGET} before the meeting ended.`,
      `The report included new information about the ${TARGET}.`,
    ];
  }

  if (leaf === "adjectives") {
    return [
      `The situation seemed ${TARGET} at first.`,
      `They described the experience as ${TARGET}.`,
      `The result was surprisingly ${TARGET}.`,
    ];
  }

  if (["verbs", "verb phrases"].includes(leaf)) {
    return [
      `They decided to ${TARGET} before the deadline.`,
      `We may need to ${TARGET} again tomorrow.`,
      `Everyone had a chance to ${TARGET}.`,
    ];
  }

  if (leaf === "adverbs") {
    if (FREQUENCY_ADVERBS.has(normalizedAnswer)) {
      return [
        `They ${TARGET} arrive early.`,
        `She ${TARGET} checks the details twice.`,
        `We ${TARGET} meet on Fridays.`,
      ];
    }
    if (DEGREE_ADVERBS.has(normalizedAnswer)) {
      return [
        `The task was ${TARGET} difficult.`,
        `The result was ${TARGET} different from what we expected.`,
        `The room became ${TARGET} quiet.`,
      ];
    }
    return [
      `She responded ${TARGET} to the question.`,
      `The situation changed ${TARGET}.`,
      `He spoke ${TARGET} during the meeting.`,
    ];
  }

  if (["phrases", "idioms"].includes(leaf)) {
    return [
      `People sometimes ${TARGET} when circumstances change.`,
      `They had to ${TARGET} before they could continue.`,
      `We may need to ${TARGET} in this situation.`,
    ];
  }

  return null;
}

export function genericSourceTemplates(category) {
  if (importedBookParts(category)) {
    throw new Error(
      "Generic sentence generation for imported vocabulary books is disabled; use the curated sentence catalog instead."
    );
  }
  return null;
}
