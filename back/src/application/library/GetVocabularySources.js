import { ValidationError } from "../../domain/errors.js";

function vocabularyIds(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  const ids = [...new Set(values.map((item) => String(item ?? "").trim()).filter(Boolean))];
  if (ids.length > 50) {
    throw new ValidationError(
      "TOO_MANY_VOCABULARY_IDS",
      "At most 50 vocabulary ids may be requested at once."
    );
  }
  for (const id of ids) {
    if (id.length > 64) {
      throw new ValidationError("INVALID_VOCABULARY_ID", "Vocabulary ids must be at most 64 characters.");
    }
  }
  return ids;
}

export class GetVocabularySources {
  constructor({ vocabularySourceRepository }) {
    this.vocabularySourceRepository = vocabularySourceRepository;
  }

  async execute(userId, input = {}) {
    const ids = vocabularyIds(input.ids);
    if (!ids.length) return { sources: [] };
    return {
      sources: await this.vocabularySourceRepository.findByVocabularyIds(userId, ids)
    };
  }
}
