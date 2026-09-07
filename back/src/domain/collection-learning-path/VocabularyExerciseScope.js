import { ValidationError } from "../errors.js";

export const VOCABULARY_SCOPE_KIND = Object.freeze({
  LISTENING_EPISODE: "listening-episode",
  COLLECTION_SECTION: "collection-section",
});

const SUPPORTED_KINDS = new Set(Object.values(VOCABULARY_SCOPE_KIND));

function invalid(code, label, message) {
  throw new ValidationError(code, `${label} ${message}`);
}

export function parseVocabularyExerciseScope(value, {
  code = "INVALID_VOCABULARY_EXERCISE_SCOPE",
  label = "vocabulary scope",
} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(code, label, "is required.");
  }
  const kind = String(value.kind ?? "").trim();
  if (!SUPPORTED_KINDS.has(kind)) {
    invalid(code, `${label}.kind`, `must be one of: ${[...SUPPORTED_KINDS].join(", ")}.`);
  }
  const ref = String(value.ref ?? "").trim();
  if (!ref || ref.length > 64) {
    invalid(code, `${label}.ref`, "must be a valid public id of at most 64 characters.");
  }
  return Object.freeze({ kind, ref });
}

export function isSupportedVocabularyScopeKind(kind) {
  return SUPPORTED_KINDS.has(String(kind ?? "").trim());
}
