import { TARGET } from "./SentenceTemplateCatalog.js";

function categoryParts(category) {
  return String(category || "")
    .split(" / ")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function genericSourceTemplates(category) {
  const parts = categoryParts(category);
  if (!parts.length) return null;
  const root = parts[0];
  const leaf = parts.at(-1).toLocaleLowerCase("en");
  const fromImportedBook = /^(unit\s+\d+|file\s+\d+)/iu.test(root);
  if (!fromImportedBook) return null;

  if (["nouns", "compound nouns"].includes(leaf)) {
    return [
      `The discussion included useful information about ${TARGET}.`,
      `The report gives a practical example involving ${TARGET}.`,
      `The lecturer returned to ${TARGET} later in the lesson.`,
    ];
  }

  if (leaf === "adjectives") {
    return [
      `The speaker described the situation as ${TARGET}.`,
      `The reviewer considered the result ${TARGET}.`,
      `They found the experience surprisingly ${TARGET}.`,
    ];
  }

  if (["verbs", "verb phrases"].includes(leaf)) {
    return [
      `The lesson includes a practical example built around ${TARGET}.`,
      `The teacher returned to ${TARGET} during the exercise.`,
      `The group discussed how ${TARGET} works in context.`,
    ];
  }

  if (leaf === "adverbs") {
    return [
      `The report uses ${TARGET} to qualify the statement.`,
      `The speaker included ${TARGET} in the explanation.`,
      `The lecturer highlighted ${TARGET} during the example.`,
    ];
  }

  if (["phrases", "idioms"].includes(leaf)) {
    return [
      `The conversation naturally included the expression ${TARGET}.`,
      `The lesson gives a useful context for ${TARGET}.`,
      `The speaker returned to ${TARGET} later in the discussion.`,
    ];
  }

  return [
    `The conversation included a clear example involving ${TARGET}.`,
    `The lesson returned to ${TARGET} during the discussion.`,
    `The notes include a short example connected with ${TARGET}.`,
  ];
}
