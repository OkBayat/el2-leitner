import { ValidationError } from "../../domain/errors.js";

const ALLOWED_SOURCES = new Set(["daily", "home-selection"]);

function invalid(message) {
  throw new ValidationError("INVALID_VOCABULARY_ACTIVATION_BATCH", message);
}

function nonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) invalid(`${name} must be a non-negative integer.`);
  return number;
}

function requiredDay(value, name) {
  const day = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) invalid(`${name} must be a YYYY-MM-DD date.`);
  return day;
}

function vocabularyIds(value) {
  if (!Array.isArray(value)) invalid("vocabularyIds must be an array.");
  const ids = [...new Set(value.map((item) => String(item ?? "").trim()))];
  if (!ids.length || ids.length > 50 || ids.some((id) => !id || id.length > 64)) {
    invalid("vocabularyIds must contain between 1 and 50 valid ids.");
  }
  return ids;
}

export class ActivateVocabularyBatch {
  constructor({ vocabularyActivationRepository }) {
    this.vocabularyActivationRepository = vocabularyActivationRepository;
  }

  async execute(userId, input = {}) {
    const expectedRevision = nonNegativeInteger(input.revision, "revision");
    const ids = vocabularyIds(input.vocabularyIds);
    const day = requiredDay(input.day, "day");
    const source = String(input.source ?? "").trim();
    if (!ALLOWED_SOURCES.has(source)) invalid("source must be daily or home-selection.");

    const revision = await this.vocabularyActivationRepository.activateBatch(userId, {
      expectedRevision,
      vocabularyIds: ids,
      day,
      source
    });
    return { revision };
  }
}
