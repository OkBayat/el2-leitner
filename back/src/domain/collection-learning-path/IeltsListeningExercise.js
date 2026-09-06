import { ValidationError } from "../errors.js";

export const IELTS_LISTENING_TYPE = "listening.ielts";
export const IELTS_LISTENING_SCHEMA_VERSION = 1;
export const IELTS_LISTENING_COMPLETION_POLICY = "listening-ielts";
export const IELTS_LISTENING_EVIDENCE_TYPE = "listening-attempt";

function invalid(message) {
  throw new ValidationError("INVALID_IELTS_LISTENING_DEFINITION", message);
}

function requiredText(value, field, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) {
    invalid(`listening.ielts config.${field} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return text;
}

export function resolveIeltsListeningReference(exercise) {
  if (exercise?.type !== IELTS_LISTENING_TYPE) {
    invalid(`Exercise type must be ${IELTS_LISTENING_TYPE}.`);
  }
  if (Number(exercise.schemaVersion) !== IELTS_LISTENING_SCHEMA_VERSION) {
    invalid(`listening.ielts schemaVersion must be ${IELTS_LISTENING_SCHEMA_VERSION}.`);
  }
  if (exercise.completionPolicy !== IELTS_LISTENING_COMPLETION_POLICY) {
    invalid(`listening.ielts completionPolicy must be ${IELTS_LISTENING_COMPLETION_POLICY}.`);
  }
  if (!exercise.config || typeof exercise.config !== "object" || Array.isArray(exercise.config)) {
    invalid("listening.ielts config is required.");
  }

  return Object.freeze({
    lessonSlug: requiredText(exercise.config.lessonSlug, "lessonSlug", 160),
    testId: requiredText(exercise.config.testId, "testId", 64),
  });
}
