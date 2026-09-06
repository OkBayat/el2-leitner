import { ValidationError } from "../errors.js";
import { classifyVocabularyProgress, VOCABULARY_PROGRESS_STATE } from "../learning/VocabularyProgress.js";

export const VOCABULARY_MASTERY_CHECK_TYPE = "vocabulary.mastery-check";
export const VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION = 1;
export const VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY = "vocabulary-mastery-check";
export const VOCABULARY_MASTERY_CHECK_SESSION_MODE = "learning-path.mastery-check";
const SUPPORTED_SCOPE_KIND = "listening-episode";

function invalid(message) {
  throw new ValidationError("INVALID_VOCABULARY_MASTERY_CHECK_DEFINITION", message);
}

function requiredIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 160) invalid(`${label} must be a valid public id.`);
  return normalized;
}

export function resolveVocabularyMasteryCheckScope(exercise) {
  if (exercise?.type !== VOCABULARY_MASTERY_CHECK_TYPE) {
    invalid(`Exercise type must be ${VOCABULARY_MASTERY_CHECK_TYPE}.`);
  }
  if (Number(exercise.schemaVersion) !== VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION) {
    invalid(`vocabulary.mastery-check schemaVersion must be ${VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION}.`);
  }
  if (exercise.completionPolicy !== VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY) {
    invalid(`vocabulary.mastery-check completionPolicy must be ${VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY}.`);
  }
  const scope = exercise.config?.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    invalid("vocabulary.mastery-check config.scope is required.");
  }
  if (scope.kind !== SUPPORTED_SCOPE_KIND) {
    invalid(`vocabulary.mastery-check scope.kind must be ${SUPPORTED_SCOPE_KIND}.`);
  }
  return Object.freeze({
    kind: SUPPORTED_SCOPE_KIND,
    ref: requiredIdentifier(scope.ref, "vocabulary.mastery-check scope.ref"),
  });
}

export function createVocabularyMasteryCheckPayload(scope, scopedVocabulary = []) {
  const seen = new Set();
  const items = [];
  for (const item of scopedVocabulary) {
    const id = String(item?.vocabularyId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (classifyVocabularyProgress(item.progress ?? null) !== VOCABULARY_PROGRESS_STATE.MASTERED) continue;
    items.push({ id, term: String(item.term ?? "").trim() });
  }
  return {
    scope: { kind: scope.kind, ref: scope.ref },
    items,
    summary: { eligibleCount: items.length },
  };
}

export function createVocabularyMasteryCheckSessionMetadata(exercise, scope, vocabularyIds) {
  const ids = [...vocabularyIds].map((value) => requiredIdentifier(value, "mastery vocabulary id"));
  if (new Set(ids).size !== ids.length) invalid("vocabulary.mastery-check session vocabulary ids must be unique.");
  return {
    learningPath: {
      kind: VOCABULARY_MASTERY_CHECK_TYPE,
      schemaVersion: VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION,
      exerciseId: requiredIdentifier(exercise?.id, "vocabulary.mastery-check exercise id"),
      scope: { kind: scope.kind, ref: scope.ref },
      vocabularyIds: ids,
    },
  };
}

export function parseVocabularyMasteryCheckSessionSnapshot(metadata) {
  const root = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : null;
  const learningPath = root?.learningPath;
  if (!learningPath || typeof learningPath !== "object" || Array.isArray(learningPath)) return null;
  if (learningPath.kind !== VOCABULARY_MASTERY_CHECK_TYPE) return null;
  if (Number(learningPath.schemaVersion) !== VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION) return null;
  const exerciseId = String(learningPath.exerciseId ?? "").trim();
  const scope = learningPath.scope;
  const rawIds = learningPath.vocabularyIds;
  if (!exerciseId || !scope || typeof scope !== "object" || Array.isArray(scope) || !Array.isArray(rawIds)) return null;
  const kind = String(scope.kind ?? "").trim();
  const ref = String(scope.ref ?? "").trim();
  if (kind !== SUPPORTED_SCOPE_KIND || !ref) return null;
  const vocabularyIds = rawIds.map((value) => String(value ?? "").trim());
  if (vocabularyIds.some((id) => !id) || new Set(vocabularyIds).size !== vocabularyIds.length) return null;
  return { exerciseId, scope: { kind, ref }, vocabularyIds };
}

export function vocabularyMasterySnapshotMatchesExercise(snapshot, exercise, scope) {
  if (!snapshot) return false;
  if (snapshot.exerciseId !== exercise.id) return false;
  return snapshot.scope.kind === scope.kind && snapshot.scope.ref === scope.ref;
}

export function reviewedVocabularyMatchesMasterySnapshot(snapshot, reviewedVocabularyIds = []) {
  if (!snapshot || !Array.isArray(reviewedVocabularyIds)) return false;
  const reviewed = reviewedVocabularyIds.map((value) => String(value ?? "").trim());
  if (reviewed.length !== snapshot.vocabularyIds.length) return false;
  if (reviewed.some((id) => !id) || new Set(reviewed).size !== reviewed.length) return false;
  const expected = new Set(snapshot.vocabularyIds);
  return reviewed.every((id) => expected.has(id));
}

export function vocabularyMasteryCheckEvidenceRef(scope, sessionId = null) {
  return sessionId
    ? `${scope.kind}:${scope.ref}:session:${sessionId}`
    : `${scope.kind}:${scope.ref}:empty`;
}
