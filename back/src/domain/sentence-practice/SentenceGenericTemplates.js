import { TARGET } from "./SentenceTemplateCatalog.js";

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

export function legacyImportedSourceTemplates(category) {
  const imported = importedBookParts(category);
  if (!imported) return null;
  const { leaf } = imported;

  if (["nouns", "compound nouns"].includes(leaf)) {
    return [
      `The discussion included useful information about ${TARGET}.`,
      `The report gives a practical example involving ${TARGET}.`,
      `The lecturer mentioned ${TARGET} again later in the lesson.`,
    ];
  }

  if (leaf === "adjectives") {
    return [
      `The speaker used “${TARGET}” as a description.`,
      `The reviewer chose “${TARGET}” as the best description.`,
      `The example showed how “${TARGET}” can be used naturally.`,
    ];
  }

  if (["verbs", "verb phrases"].includes(leaf)) {
    return [
      `The lesson included an example using “${TARGET}”.`,
      `The teacher reviewed how “${TARGET}” is used during the exercise.`,
      `The group discussed how “${TARGET}” is used in context.`,
    ];
  }

  if (leaf === "adverbs") {
    return [
      `The report used “${TARGET}” to qualify the statement.`,
      `The speaker included “${TARGET}” in the explanation.`,
      `The lecturer highlighted “${TARGET}” during the example.`,
    ];
  }

  if (["phrases", "idioms"].includes(leaf)) {
    return [
      `The conversation naturally included “${TARGET}”.`,
      `The lesson showed a useful context for “${TARGET}”.`,
      `The speaker used “${TARGET}” later in the discussion.`,
    ];
  }

  return [
    `The teacher gave a clear example using “${TARGET}”.`,
    `The term “${TARGET}” came up during the discussion.`,
    `The notes included another example with “${TARGET}”.`,
  ];
}

export function genericSourceTemplates(category) {
  if (importedBookParts(category)) {
    throw new Error(
      "Generic sentence generation for imported vocabulary books is disabled; use the curated sentence catalog instead."
    );
  }
  return null;
}
