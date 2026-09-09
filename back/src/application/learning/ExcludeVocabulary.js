import { ValidationError } from "../../domain/errors.js";

function nonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ValidationError("INVALID_VOCABULARY_EXCLUSION", `${name} must be a non-negative integer.`);
  }
  return number;
}

function requiredText(value, name, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) {
    throw new ValidationError(
      "INVALID_VOCABULARY_EXCLUSION",
      `${name} is required and must be at most ${maxLength} characters.`
    );
  }
  return text;
}

export class ExcludeVocabulary {
  constructor({ vocabularyActivationRepository }) {
    this.vocabularyActivationRepository = vocabularyActivationRepository;
  }

  async execute(userId, input = {}) {
    const expectedRevision = nonNegativeInteger(input.revision, "revision");
    const vocabularyId = requiredText(input.vocabularyId, "vocabularyId", 64);
    const revision = await this.vocabularyActivationRepository.exclude(userId, {
      expectedRevision,
      vocabularyId
    });
    return { revision };
  }
}
