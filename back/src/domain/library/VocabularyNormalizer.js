import { ValidationError } from "../errors.js";

export function normalizeVocabularyForm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/gu, "'")
    .replace(/[–—]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

export function cleanVocabularyForms(primaryForm, acceptedForms = []) {
  const candidates = [primaryForm, ...(Array.isArray(acceptedForms) ? acceptedForms : [])];
  const seen = new Set();
  const forms = [];

  for (const candidate of candidates) {
    const form = String(candidate ?? "").trim();
    const normalized = normalizeVocabularyForm(form);
    if (!normalized || seen.has(normalized)) continue;
    if (form.length > 512) {
      throw new ValidationError("VOCABULARY_FORM_TOO_LONG", "Vocabulary forms must be at most 512 characters.");
    }
    seen.add(normalized);
    forms.push({ form, normalized });
  }

  if (!forms.length) {
    throw new ValidationError("INVALID_VOCABULARY_FORM", "Enter at least one vocabulary form.");
  }
  return forms;
}

export function publicCanonicalKey(languageCode, normalizedForm) {
  return `public:${languageCode}:${normalizedForm}`;
}

export function privateCanonicalKey(userId, languageCode, normalizedForm) {
  return `user:${String(userId)}:${languageCode}:${normalizedForm}`;
}
