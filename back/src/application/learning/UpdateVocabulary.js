import { ValidationError } from "../../domain/errors.js";
import { cleanVocabularyForms } from "../../domain/library/VocabularyNormalizer.js";

function revisionValue(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new ValidationError("INVALID_REVISION", "Revision must be a non-negative safe integer.");
  }
  return revision;
}

function categoryValue(value) {
  const category = String(value ?? "").trim() || "Uncategorized";
  if (category.length > 255) {
    throw new ValidationError("CATEGORY_TOO_LONG", "Category must be at most 255 characters.");
  }
  return category;
}

function noteValue(value) {
  const note = String(value ?? "").trim();
  if (note.length > 10_000) {
    throw new ValidationError("NOTE_TOO_LONG", "Note must be at most 10000 characters.");
  }
  return note;
}

export class UpdateVocabulary {
  constructor({ learningStateRepository }) {
    this.learningStateRepository = learningStateRepository;
  }

  async execute(userId, vocabularyId, input = {}) {
    const forms = cleanVocabularyForms(input.term, input.acceptedForms);
    const revision = revisionValue(input.revision);
    const word = {
      id: String(vocabularyId || "").trim(),
      term: forms[0].form,
      accepted: forms.map(({ form }) => form),
      category: categoryValue(input.category),
      notes: noteValue(input.notes)
    };
    if (!word.id) {
      throw new ValidationError("INVALID_VOCABULARY_ID", "Vocabulary id is required.");
    }

    const nextRevision = await this.learningStateRepository.updateVocabulary(
      userId,
      word,
      revision
    );
    return { revision: nextRevision, word };
  }
}
