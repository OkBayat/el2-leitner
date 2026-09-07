import { ValidationError } from "../errors.js";
import { classifyVocabularyProgress } from "../learning/VocabularyProgress.js";
import { parseVocabularyExerciseScope } from "./VocabularyExerciseScope.js";

export const VOCABULARY_INTAKE_TYPE = "vocabulary.intake";
export const VOCABULARY_INTAKE_SCHEMA_VERSION = 1;
export const VOCABULARY_INTAKE_COMPLETION_POLICY = "vocabulary-intake";

function invalid(message) {
  throw new ValidationError("INVALID_VOCABULARY_INTAKE_DEFINITION", message);
}

export function resolveVocabularyIntakeScope(exercise) {
  if (exercise?.type !== VOCABULARY_INTAKE_TYPE) {
    invalid(`Exercise type must be ${VOCABULARY_INTAKE_TYPE}.`);
  }
  if (Number(exercise.schemaVersion) !== VOCABULARY_INTAKE_SCHEMA_VERSION) {
    invalid(`vocabulary.intake schemaVersion must be ${VOCABULARY_INTAKE_SCHEMA_VERSION}.`);
  }
  if (exercise.completionPolicy !== VOCABULARY_INTAKE_COMPLETION_POLICY) {
    invalid(`vocabulary.intake completionPolicy must be ${VOCABULARY_INTAKE_COMPLETION_POLICY}.`);
  }
  return parseVocabularyExerciseScope(exercise.config?.scope, {
    code: "INVALID_VOCABULARY_INTAKE_DEFINITION",
    label: "vocabulary.intake scope",
  });
}

function textList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function createVocabularyIntakePayload(scope, scopedVocabulary = []) {
  const seen = new Set();
  const items = [];
  for (const item of scopedVocabulary) {
    const id = String(item.vocabularyId);
    if (seen.has(id)) continue;
    seen.add(id);
    const state = classifyVocabularyProgress(item.progress ?? null);
    items.push({
      id,
      term: String(item.term ?? "").trim(),
      definitions: textList(item.definitions),
      examples: textList(item.examples),
      progress: {
        state,
        box: Math.max(0, Number(item.progress?.box ?? 0) || 0),
      },
    });
  }
  const count = (state) => items.filter((item) => item.progress.state === state).length;
  return {
    scope: { kind: scope.kind, ref: scope.ref },
    items,
    summary: {
      total: items.length,
      newCount: count("new"),
      learningCount: count("learning"),
      masteredCount: count("mastered"),
      excludedCount: count("excluded"),
    },
  };
}

export function vocabularyIntakeReadyForCompletion(payload) {
  return Number(payload?.summary?.total ?? 0) > 0
    && Number(payload?.summary?.newCount ?? 0) === 0;
}

export function vocabularyIntakeEvidenceRef(scope) {
  return `${scope.kind}:${scope.ref}`;
}
