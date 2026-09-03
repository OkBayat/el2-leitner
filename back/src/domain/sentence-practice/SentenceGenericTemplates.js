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

const COMMON_VERB_STARTERS = new Set([
  "be",
  "become",
  "begin",
  "book",
  "break",
  "bring",
  "buy",
  "call",
  "carry",
  "catch",
  "change",
  "check",
  "choose",
  "clean",
  "close",
  "come",
  "cook",
  "cut",
  "do",
  "drink",
  "drive",
  "eat",
  "feel",
  "fill",
  "find",
  "finish",
  "get",
  "give",
  "go",
  "grow",
  "have",
  "help",
  "keep",
  "know",
  "learn",
  "leave",
  "like",
  "live",
  "look",
  "lose",
  "make",
  "meet",
  "move",
  "need",
  "open",
  "order",
  "pay",
  "play",
  "put",
  "read",
  "remember",
  "rent",
  "run",
  "say",
  "see",
  "sell",
  "send",
  "set",
  "show",
  "sit",
  "spend",
  "start",
  "stay",
  "stop",
  "study",
  "take",
  "talk",
  "tell",
  "think",
  "travel",
  "try",
  "turn",
  "use",
  "visit",
  "wait",
  "walk",
  "want",
  "wash",
  "watch",
  "wear",
  "work",
  "write",
]);

const COMMON_ADJECTIVES = new Set([
  "baked",
  "bitter",
  "boiled",
  "busy",
  "cheap",
  "crowded",
  "delicious",
  "empty",
  "expensive",
  "fresh",
  "fried",
  "friendly",
  "frozen",
  "full",
  "grilled",
  "healthy",
  "noisy",
  "quiet",
  "raw",
  "roast",
  "salty",
  "sour",
  "spicy",
  "sweet",
  "unhealthy",
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

function inferredLexicalType(answerText) {
  const normalized = String(answerText).trim().toLocaleLowerCase("en");
  if (!normalized) return "nouns";
  if (FREQUENCY_ADVERBS.has(normalized) || DEGREE_ADVERBS.has(normalized) || /ly$/u.test(normalized)) {
    return "adverbs";
  }
  if (COMMON_ADJECTIVES.has(normalized) || /(able|ible|al|ant|ent|ary|ful|ic|ical|ive|less|ous)$/u.test(normalized)) {
    return "adjectives";
  }
  const [firstWord] = normalized.split(/\s+/u);
  if (firstWord === "to" || COMMON_VERB_STARTERS.has(firstWord)) {
    return "verb phrases";
  }
  return "nouns";
}

export function naturalImportedSourceTemplates(category, answerText = "") {
  const imported = importedBookParts(category);
  if (!imported) return null;
  const normalizedAnswer = String(answerText).trim().toLocaleLowerCase("en");
  const explicitLeaf = imported.leaf;
  const leaf = [
    "nouns",
    "compound nouns",
    "adjectives",
    "verbs",
    "verb phrases",
    "adverbs",
    "phrases",
    "idioms",
  ].includes(explicitLeaf)
    ? explicitLeaf
    : inferredLexicalType(answerText);

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
    const infinitivePrefix = normalizedAnswer.startsWith("to ") ? "" : "to ";
    return [
      `They decided ${infinitivePrefix}${TARGET} before the deadline.`,
      `We may need ${infinitivePrefix}${TARGET} again tomorrow.`,
      `Everyone had a chance ${infinitivePrefix}${TARGET}.`,
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
