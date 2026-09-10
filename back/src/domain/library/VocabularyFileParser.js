import { ValidationError } from "../errors.js";
import { LegacyNumberedVocabularyFileParser } from "./LegacyNumberedVocabularyFileParser.js";
import { stripExclamationMarks } from "./PracticeContentSanitizer.js";
import { cleanVocabularyForms } from "./VocabularyNormalizer.js";

const MAX_IMPORT_BYTES = 2_000_000;
const MAX_IMPORT_ITEMS = 20_000;
const MAX_DEFINITION_LENGTH = 2_000;
const MAX_EXAMPLE_LENGTH = 1_000;

function invalidLine(lineNumber, message) {
  throw new ValidationError("INVALID_COLLECTION_SOURCE", `Line ${lineNumber}: ${message}`);
}

export class VocabularyFileParser {
  parse(text, { requireStructured = false } = {}) {
    if (typeof text !== "string") {
      throw new ValidationError("INVALID_IMPORT", "Collection import must be plain text.");
    }
    if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
      throw new ValidationError("IMPORT_TOO_LARGE", "Collection import is too large.");
    }

    const sanitizedText = stripExclamationMarks(text);
    const hasBookHeading = sanitizedText.split(/\r?\n/u).some((line) => /^#(?!#)\s+\S/u.test(line));
    if (!hasBookHeading && !requireStructured) {
      return new LegacyNumberedVocabularyFileParser().parse(sanitizedText);
    }

    let title = null;
    let currentSection = null;
    let currentEntry = null;
    const sections = [];
    const sectionTitles = new Set();
    const entries = [];
    const seenVocabularyForms = new Set();

    const flushEntry = (lineNumber) => {
      if (!currentEntry) return;
      if (!currentEntry.definitions.length) {
        invalidLine(lineNumber, `Vocabulary item "${currentEntry.primaryForm}" needs at least one definition.`);
      }
      entries.push(currentEntry);
      currentEntry = null;
    };

    const lines = sanitizedText.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index];
      const lineNumber = index + 1;
      if (!rawLine.trim()) continue;

      const bookHeading = rawLine.match(/^#(?!#)\s+(.+?)\s*$/u);
      if (bookHeading) {
        flushEntry(lineNumber);
        if (title) invalidLine(lineNumber, "A collection file can contain only one book title (# heading).");
        if (sections.length || entries.length) invalidLine(lineNumber, "The book title must be the first content in the file.");
        title = bookHeading[1].trim();
        if (!title || title.length > 255) invalidLine(lineNumber, "Book title must be between 1 and 255 characters.");
        continue;
      }

      const lessonHeading = rawLine.match(/^##(?!#)\s+(.+?)\s*$/u);
      if (lessonHeading) {
        flushEntry(lineNumber);
        if (!title) invalidLine(lineNumber, "Add a # book title before lessons.");
        const lessonTitle = lessonHeading[1].trim();
        if (!lessonTitle || lessonTitle.length > 255) {
          invalidLine(lineNumber, "Lesson title must be between 1 and 255 characters.");
        }
        if (sectionTitles.has(lessonTitle)) {
          invalidLine(lineNumber, `Lesson "${lessonTitle}" is repeated in the same collection.`);
        }
        sectionTitles.add(lessonTitle);
        currentSection = {
          path: lessonTitle,
          title: lessonTitle,
          parentPath: null,
          position: sections.length + 1
        };
        sections.push(currentSection);
        continue;
      }

      const vocabularyLine = rawLine.match(/^-\s+(.+?)\s*$/u);
      if (vocabularyLine) {
        flushEntry(lineNumber);
        if (!title) invalidLine(lineNumber, "Add a # book title before vocabulary items.");
        if (!currentSection) invalidLine(lineNumber, "Every vocabulary item must belong to a ## lesson.");
        if (entries.length >= MAX_IMPORT_ITEMS) {
          throw new ValidationError("TOO_MANY_IMPORT_ITEMS", `A collection can contain at most ${MAX_IMPORT_ITEMS} vocabulary items.`);
        }

        const rawForms = vocabularyLine[1]
          .split(/\s+\/\s+/u)
          .map((value) => value.trim())
          .filter(Boolean);
        const forms = cleanVocabularyForms(rawForms[0], rawForms.slice(1));
        const normalizedForms = forms.map(({ normalized }) => normalized);
        const duplicate = normalizedForms.find((normalized) => seenVocabularyForms.has(normalized));
        if (duplicate) {
          invalidLine(
            lineNumber,
            `Vocabulary item "${forms[0].form}" overlaps another item in this collection. Keep each vocabulary identity in one lesson only.`
          );
        }
        normalizedForms.forEach((normalized) => seenVocabularyForms.add(normalized));

        currentEntry = {
          sourceNumber: entries.length + 1,
          position: entries.length + 1,
          primaryForm: forms[0].form,
          acceptedForms: forms.map(({ form }) => form),
          sectionPath: currentSection.path,
          definitions: [],
          examples: []
        };
        continue;
      }

      const propertyLine = rawLine.match(/^\s{2,}-\s+(definition|example):\s*(.+?)\s*$/iu);
      if (propertyLine) {
        if (!currentEntry) invalidLine(lineNumber, "Definitions and examples must be placed under a vocabulary item.");
        const type = propertyLine[1].toLowerCase();
        const value = propertyLine[2].trim();
        if (!value) invalidLine(lineNumber, `${type} cannot be empty.`);
        if (type === "definition") {
          if (value.length > MAX_DEFINITION_LENGTH) {
            invalidLine(lineNumber, `Definition must be at most ${MAX_DEFINITION_LENGTH} characters.`);
          }
          currentEntry.definitions.push(value);
        } else {
          if (value.length > MAX_EXAMPLE_LENGTH) {
            invalidLine(lineNumber, `Example must be at most ${MAX_EXAMPLE_LENGTH} characters.`);
          }
          currentEntry.examples.push(value);
        }
        continue;
      }

      invalidLine(lineNumber, "Unsupported syntax. Use # book, ## lesson, - vocabulary, and indented definition/example lines.");
    }

    flushEntry(lines.length + 1);

    if (!title) {
      throw new ValidationError("MISSING_COLLECTION_TITLE", "Collection file needs a # book title.");
    }
    if (!sections.length) {
      throw new ValidationError("EMPTY_COLLECTION_SECTIONS", "Collection file needs at least one ## lesson.");
    }
    if (!entries.length && !requireStructured) {
      throw new ValidationError("EMPTY_IMPORT", "No vocabulary items were found in the collection file.");
    }
    return {
      title,
      sections,
      entries,
      sourceItemCount: entries.length,
      duplicateCount: 0
    };
  }
}

export {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ITEMS,
  MAX_DEFINITION_LENGTH,
  MAX_EXAMPLE_LENGTH
};
