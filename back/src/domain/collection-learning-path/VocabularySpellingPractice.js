import { ValidationError } from "../errors.js";
import { classifyVocabularyProgress } from "../learning/VocabularyProgress.js";

export const SLIDE_BASE_EXERCISE_TYPE = "slide-base";
export const VOCABULARY_SPELLING_SCHEMA_VERSION = 1;
export const VOCABULARY_SPELLING_COMPLETION_POLICY = "vocabulary-spelling";
export const VOCABULARY_SPELLING_SESSION_MODE = "learning-path.spelling";
export const VOCABULARY_SPELLING_SCOPE = Object.freeze({ COURSE: "course", ALL: "all" });
export const VOCABULARY_SPELLING_AGGREGATION_MODE = Object.freeze({
  FIRST: "first-attempts",
  ALL: "all-attempts",
  LATEST: "latest-attempts",
});

const VALID_SCOPES = new Set(Object.values(VOCABULARY_SPELLING_SCOPE));
const VALID_AGGREGATION_MODES = new Set(Object.values(VOCABULARY_SPELLING_AGGREGATION_MODE));

function invalid(message) {
  throw new ValidationError("INVALID_VOCABULARY_SPELLING_DEFINITION", message);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function requiredIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 160) invalid(`${label} must be a valid public id.`);
  return normalized;
}

export function parseVocabularySpellingScope(value) {
  const scope = String(value ?? "").trim();
  return VALID_SCOPES.has(scope) ? scope : null;
}

export function parseVocabularySpellingAggregationMode(value) {
  const mode = String(value ?? VOCABULARY_SPELLING_AGGREGATION_MODE.FIRST).trim();
  return VALID_AGGREGATION_MODES.has(mode) ? mode : null;
}

export function resolveVocabularySpellingDefinition(path, exercise) {
  if (exercise?.type !== SLIDE_BASE_EXERCISE_TYPE) invalid(`Exercise type must be ${SLIDE_BASE_EXERCISE_TYPE}.`);
  if (Number(exercise.schemaVersion) !== VOCABULARY_SPELLING_SCHEMA_VERSION) {
    invalid(`slide-base vocabulary spelling schemaVersion must be ${VOCABULARY_SPELLING_SCHEMA_VERSION}.`);
  }
  if (exercise.completionPolicy !== VOCABULARY_SPELLING_COMPLETION_POLICY) {
    invalid(`Completion policy must be ${VOCABULARY_SPELLING_COMPLETION_POLICY}.`);
  }
  const config = record(exercise.config);
  if (!config || Object.keys(config).some((key) => key !== "slides") || !Array.isArray(config.slides)) {
    invalid("slide-base vocabulary spelling config must contain only slides.");
  }
  if (config.slides.length !== 2) invalid("Vocabulary spelling must start with exactly a scope slide and a summary slide.");
  const [scopeSlide, summarySlide] = config.slides;
  const scopeData = record(scopeSlide?.data);
  const generatedSlide = record(scopeData?.generatedSlide);
  if (scopeSlide?.type !== "leitner-house-one-scope" || generatedSlide?.type !== "dictation") {
    invalid("The first slide must generate dictation slides from Leitner House 1.");
  }
  if (Object.keys(scopeData).some((key) => key !== "generatedSlide")) {
    invalid("The Leitner House 1 scope slide accepts only generatedSlide data.");
  }
  const summaryData = record(summarySlide?.data) ?? {};
  const aggregationMode = parseVocabularySpellingAggregationMode(summaryData.aggregationMode);
  if (summarySlide?.type !== "summary" || summarySlide?.terminal !== true || !aggregationMode) {
    invalid("The last slide must be a terminal summary with a supported aggregation mode.");
  }
  return {
    collectionId: requiredIdentifier(path?.collectionId, "learning path collection id"),
    aggregationMode,
  };
}

export function resolveVocabularySpellingCollectionId(path, exercise) {
  return resolveVocabularySpellingDefinition(path, exercise).collectionId;
}

function acceptedForms(item, term) {
  return [...new Set([term, ...(Array.isArray(item?.accepted) ? item.accepted : [])]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))];
}

function eligibleItem(item) {
  const id = String(item?.vocabularyId ?? "").trim();
  const term = String(item?.term ?? "").trim();
  const progress = item?.progress ?? null;
  if (!id || !term || classifyVocabularyProgress(progress) !== "learning" || Number(progress?.box) !== 1) return null;
  return { id, term, accepted: acceptedForms(item, term) };
}

export function createVocabularySpellingPayload(collectionId, vocabulary = []) {
  const seen = new Set();
  const courseItems = [];
  const allItems = [];
  for (const source of vocabulary) {
    const item = eligibleItem(source);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    allItems.push(item);
    if (source.courseMember === true) courseItems.push(item);
  }
  return {
    collectionId,
    courseItems,
    allItems,
    summary: { box: 1, courseCount: courseItems.length, allCount: allItems.length },
  };
}

export function vocabularySpellingItemsForScope(payload, scope) {
  return scope === VOCABULARY_SPELLING_SCOPE.COURSE
    ? payload.courseItems
    : scope === VOCABULARY_SPELLING_SCOPE.ALL
      ? payload.allItems
      : [];
}

export function createVocabularySpellingSessionMetadata({ path, lesson, exercise, scope, aggregationMode, vocabularyIds }) {
  const parsedScope = parseVocabularySpellingScope(scope);
  const parsedAggregationMode = parseVocabularySpellingAggregationMode(aggregationMode);
  if (!parsedScope || !parsedAggregationMode) invalid("Vocabulary spelling session scope and aggregation mode are required.");
  const ids = [...vocabularyIds].map((value) => requiredIdentifier(value, "spelling vocabulary id"));
  if (new Set(ids).size !== ids.length) invalid("Vocabulary spelling session vocabulary ids must be unique.");
  return {
    learningPath: {
      kind: VOCABULARY_SPELLING_COMPLETION_POLICY,
      schemaVersion: VOCABULARY_SPELLING_SCHEMA_VERSION,
      pathId: requiredIdentifier(path?.id, "learning path id"),
      lessonId: requiredIdentifier(lesson?.id, "learning path lesson id"),
      exerciseId: requiredIdentifier(exercise?.id, "learning path exercise id"),
      scope: parsedScope,
      aggregationMode: parsedAggregationMode,
      vocabularyIds: ids,
    },
  };
}

export function parseVocabularySpellingSessionSnapshot(metadata) {
  const root = record(metadata);
  const learningPath = record(root?.learningPath);
  if (!learningPath || learningPath.kind !== VOCABULARY_SPELLING_COMPLETION_POLICY) return null;
  if (Number(learningPath.schemaVersion) !== VOCABULARY_SPELLING_SCHEMA_VERSION) return null;
  const pathId = String(learningPath.pathId ?? "").trim();
  const lessonId = String(learningPath.lessonId ?? "").trim();
  const exerciseId = String(learningPath.exerciseId ?? "").trim();
  const scope = parseVocabularySpellingScope(learningPath.scope);
  const aggregationMode = parseVocabularySpellingAggregationMode(learningPath.aggregationMode);
  const vocabularyIds = Array.isArray(learningPath.vocabularyIds)
    ? learningPath.vocabularyIds.map((value) => String(value ?? "").trim())
    : null;
  if (!pathId || !lessonId || !exerciseId || !scope || !aggregationMode || !vocabularyIds) return null;
  if (vocabularyIds.some((id) => !id) || new Set(vocabularyIds).size !== vocabularyIds.length) return null;
  return { pathId, lessonId, exerciseId, scope, aggregationMode, vocabularyIds };
}

export function vocabularySpellingSnapshotMatches(snapshot, context, scope, aggregationMode) {
  return Boolean(snapshot
    && snapshot.pathId === context.path?.id
    && snapshot.lessonId === context.lesson?.id
    && snapshot.exerciseId === context.exercise?.id
    && snapshot.scope === scope
    && snapshot.aggregationMode === aggregationMode);
}

export function reviewedVocabularyMatchesSpellingSnapshot(snapshot, reviewedVocabularyIds = []) {
  if (!snapshot || !Array.isArray(reviewedVocabularyIds)) return false;
  const reviewed = reviewedVocabularyIds.map((value) => String(value ?? "").trim());
  if (reviewed.length !== snapshot.vocabularyIds.length || reviewed.some((id) => !id)) return false;
  if (new Set(reviewed).size !== reviewed.length) return false;
  const expected = new Set(snapshot.vocabularyIds);
  return reviewed.every((id) => expected.has(id));
}

export function vocabularySpellingEvidenceRef(collectionId, scope, sessionId = null) {
  const base = `collection:${collectionId}:${scope}`;
  return sessionId ? `${base}:session:${sessionId}` : `${base}:empty`;
}
