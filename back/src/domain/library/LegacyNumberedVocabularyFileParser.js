import { ValidationError } from "../errors.js";
import { cleanVocabularyForms, normalizeVocabularyForm } from "./VocabularyNormalizer.js";

const MAX_IMPORT_BYTES = 2_000_000;
const MAX_IMPORT_ITEMS = 20_000;

// Temporary compatibility parser for the existing IELTS numbered source.
// New managed collection files must use VocabularyFileParser instead.
export class LegacyNumberedVocabularyFileParser {
  parse(text) {
    if (typeof text !== "string") {
      throw new ValidationError("INVALID_IMPORT", "Vocabulary import must be plain text.");
    }
    if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
      throw new ValidationError("IMPORT_TOO_LARGE", "Vocabulary import is too large.");
    }

    const sectionStack = [];
    const sectionsByPath = new Map();
    const entries = [];
    const seenForms = new Set();
    let sourceItemCount = 0;
    let duplicateCount = 0;

    for (const rawLine of text.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line) continue;

      const heading = rawLine.match(/^\s*(#{2,6})\s+(.+?)\s*$/u);
      if (heading) {
        const depth = heading[1].length - 2;
        const title = heading[2].trim();
        if (title.length > 255) {
          throw new ValidationError("SECTION_TITLE_TOO_LONG", "Section titles must be at most 255 characters.");
        }
        sectionStack.splice(depth);
        sectionStack[depth] = title;
        const path = sectionStack.filter(Boolean).join(" / ");
        if (path && !sectionsByPath.has(path)) {
          sectionsByPath.set(path, {
            path,
            title,
            parentPath: depth > 0 ? sectionStack.slice(0, depth).filter(Boolean).join(" / ") || null : null,
            position: sectionsByPath.size + 1
          });
        }
        continue;
      }

      const numbered = rawLine.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/u);
      if (!numbered) continue;
      sourceItemCount += 1;
      if (sourceItemCount > MAX_IMPORT_ITEMS) {
        throw new ValidationError("TOO_MANY_IMPORT_ITEMS", `A collection can import at most ${MAX_IMPORT_ITEMS} items at once.`);
      }

      const rawForms = numbered[2].split(/\s+\/\s+/u).map((value) => value.trim()).filter(Boolean);
      const forms = cleanVocabularyForms(rawForms[0], rawForms.slice(1));
      const normalizedForms = forms.map(({ form }) => normalizeVocabularyForm(form));
      if (normalizedForms.some((normalized) => seenForms.has(normalized))) {
        duplicateCount += 1;
        continue;
      }
      normalizedForms.forEach((normalized) => seenForms.add(normalized));

      const sectionPath = sectionStack.filter(Boolean).join(" / ") || null;
      entries.push({
        sourceNumber: Number(numbered[1]),
        position: entries.length + 1,
        primaryForm: forms[0].form,
        acceptedForms: forms.map(({ form }) => form),
        sectionPath
      });
    }

    if (!entries.length) {
      throw new ValidationError("EMPTY_IMPORT", "No numbered vocabulary items were found in the file.");
    }

    return {
      sections: [...sectionsByPath.values()],
      entries,
      sourceItemCount,
      duplicateCount
    };
  }
}
