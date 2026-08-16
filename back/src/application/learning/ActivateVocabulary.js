import { ValidationError } from "../../domain/errors.js";

function nonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ValidationError("INVALID_VOCABULARY_ACTIVATION", `${name} must be a non-negative integer.`);
  }
  return number;
}

function requiredText(value, name, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) {
    throw new ValidationError(
      "INVALID_VOCABULARY_ACTIVATION",
      `${name} is required and must be at most ${maxLength} characters.`
    );
  }
  return text;
}

function requiredDay(value, name) {
  const day = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) {
    throw new ValidationError("INVALID_VOCABULARY_ACTIVATION", `${name} must be a YYYY-MM-DD date.`);
  }
  return day;
}

export class ActivateVocabulary {
  constructor({ vocabularyActivationRepository }) {
    this.vocabularyActivationRepository = vocabularyActivationRepository;
  }

  async execute(userId, input = {}) {
    const expectedRevision = nonNegativeInteger(input.revision, "revision");
    const vocabularyId = requiredText(input.vocabularyId, "vocabularyId", 64);
    const day = requiredDay(input.day, "day");
    const revision = await this.vocabularyActivationRepository.activate(userId, {
      expectedRevision,
      vocabularyId,
      day
    });
    return { revision };
  }
}
