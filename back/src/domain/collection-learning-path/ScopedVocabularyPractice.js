import { ValidationError } from "../errors.js";
import { classifyVocabularyProgress } from "../learning/VocabularyProgress.js";
import { parseVocabularyExerciseScope } from "./VocabularyExerciseScope.js";

export const VOCABULARY_QUICK_REVIEW_TYPE = "vocabulary.quick-review";
export const VOCABULARY_QUICK_REVIEW_SCHEMA_VERSION = 1;
export const VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY = "vocabulary-quick-review";
export const VOCABULARY_QUICK_REVIEW_SESSION_MODE = "learning-path.quick-review";

function invalid(message) {
  throw new ValidationError("INVALID_VOCABULARY_QUICK_REVIEW_DEFINITION", message);
}

export function resolveScopedVocabularyPracticeScope(exercise) {
  if (exercise?.type !== VOCABULARY_QUICK_REVIEW_TYPE) {
    invalid(`Exercise type must be ${VOCABULARY_QUICK_REVIEW_TYPE}.`);
  }
  if (Number(exercise.schemaVersion) !== VOCABULARY_QUICK_REVIEW_SCHEMA_VERSION) {
    invalid(`vocabulary.quick-review schemaVersion must be ${VOCABULARY_QUICK_REVIEW_SCHEMA_VERSION}.`);
  }
  if (exercise.completionPolicy !== VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY) {
    invalid(`vocabulary.quick-review completionPolicy must be ${VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY}.`);
  }
  return parseVocabularyExerciseScope(exercise.config?.scope, {
    code: "INVALID_VOCABULARY_QUICK_REVIEW_DEFINITION",
    label: "vocabulary.quick-review scope",
  });
}

export function createScopedVocabularyPracticePayload(scope, scopedVocabulary = []) {
  const seen = new Set();
  const items = [];
  for (const item of scopedVocabulary) {
    const id = String(item?.vocabularyId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const progress = item.progress ?? null;
    if (classifyVocabularyProgress(progress) !== "learning") continue;
    if (Number(progress?.box ?? 0) !== 1) continue;
    items.push({
      id,
      term: String(item.term ?? "").trim(),
    });
  }
  return {
    scope: { kind: scope.kind, ref: scope.ref },
    items,
    summary: {
      eligibleCount: items.length,
      box: 1,
    },
  };
}

export function scopedVocabularyPracticeEvidenceRef(scope, sessionId = null) {
  return sessionId ? `${scope.kind}:${scope.ref}:session:${sessionId}` : `${scope.kind}:${scope.ref}:empty`;
}

export function reviewedIdsMatchScope(payload, evidence) {
  const expected = new Set((payload?.items ?? []).map((item) => String(item.id)));
  const reviewed = new Set((evidence?.reviewedVocabularyIds ?? []).map(String));
  if (expected.size !== reviewed.size) return false;
  for (const id of expected) {
    if (!reviewed.has(id)) return false;
  }
  return true;
}

export function reviewedIdsProveScopedQuickReview(scopedVocabulary, payload, evidence) {
  const inScope = new Set(
    (scopedVocabulary ?? [])
      .map((item) => String(item?.vocabularyId ?? "").trim())
      .filter(Boolean),
  );
  const currentEligible = new Set((payload?.items ?? []).map((item) => String(item.id)));
  const reviewed = new Set(
    (evidence?.reviewedVocabularyIds ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean),
  );
  const plannedCount = Number(evidence?.plannedCount);
  const completedCount = Number(evidence?.completedCount);

  if (!Number.isSafeInteger(plannedCount) || plannedCount < 0) return false;
  if (!Number.isSafeInteger(completedCount) || completedCount !== plannedCount) return false;
  if (reviewed.size !== plannedCount) return false;

  for (const id of reviewed) {
    if (!inScope.has(id)) return false;
  }
  for (const id of currentEligible) {
    if (!reviewed.has(id)) return false;
  }
  return true;
}
