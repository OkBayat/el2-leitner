import { ValidationError } from "../errors.js";
import { parseVocabularyExerciseScope } from "./VocabularyExerciseScope.js";

export const SLIDE_SEQUENCE_TYPE = "slides.sequence";
export const SLIDE_SEQUENCE_SCHEMA_VERSION = 1;
export const SLIDE_SEQUENCE_COMPLETION_POLICY = "slide-sequence";
export const LESSON_VOCABULARY_SCOPE_SLIDE_TYPE = "lesson-vocabulary-scope";

const GENERATED_TYPES = new Map([
  ["dictation", "dictation"],
  ["meaning-choice", "choice"],
]);
const UNSCORED_TYPES = new Set(["message", "teaching-card", "summary", LESSON_VOCABULARY_SCOPE_SLIDE_TYPE]);
const SUBMITTED_TYPES = new Set(["speaking-response", "writing-response"]);

function invalid(message) {
  throw new ValidationError("INVALID_SLIDE_SEQUENCE_DEFINITION", message);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function identifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 160) invalid(`${label} must be a valid public id.`);
  return normalized;
}

export function resolveSlideSequenceDefinition(exercise) {
  if (exercise?.type !== SLIDE_SEQUENCE_TYPE) invalid(`Exercise type must be ${SLIDE_SEQUENCE_TYPE}.`);
  if (Number(exercise.schemaVersion) !== SLIDE_SEQUENCE_SCHEMA_VERSION) {
    invalid(`slides.sequence schemaVersion must be ${SLIDE_SEQUENCE_SCHEMA_VERSION}.`);
  }
  if (exercise.completionPolicy !== SLIDE_SEQUENCE_COMPLETION_POLICY) {
    invalid(`slides.sequence completionPolicy must be ${SLIDE_SEQUENCE_COMPLETION_POLICY}.`);
  }
  const config = record(exercise.config);
  if (!config || !Array.isArray(config.slides) || config.slides.length < 2) {
    invalid("slides.sequence requires at least two configured slides.");
  }
  const slides = config.slides.map((candidate) => {
    const slide = record(candidate);
    if (!slide) invalid("slides.sequence slides must be objects.");
    return {
      id: identifier(slide.id, "slide id"),
      type: identifier(slide.type, "slide type"),
      terminal: slide.terminal === true,
      data: record(slide.data) ?? {},
    };
  });
  if (new Set(slides.map((slide) => slide.id)).size !== slides.length) invalid("slides.sequence slide ids must be unique.");
  if (slides.filter((slide) => slide.terminal).length !== 1 || !slides.at(-1).terminal) {
    invalid("slides.sequence requires exactly one terminal final slide.");
  }
  const scopeSlides = slides.filter((slide) => slide.type === LESSON_VOCABULARY_SCOPE_SLIDE_TYPE);
  const scope = config.scope === undefined
    ? null
    : parseVocabularyExerciseScope(config.scope, {
        code: "INVALID_SLIDE_SEQUENCE_DEFINITION",
        label: "slides.sequence scope",
      });
  if (scopeSlides.length > 1 || (scopeSlides.length === 1) !== Boolean(scope)) {
    invalid("A slides.sequence vocabulary scope and its generator slide must be configured together exactly once.");
  }
  let generated = null;
  if (scopeSlides[0]) {
    const generatedType = String(record(scopeSlides[0].data.generatedSlide)?.type ?? "").trim();
    const slideType = GENERATED_TYPES.get(generatedType);
    if (!slideType) invalid("Unsupported lesson vocabulary generated slide type.");
    generated = { scopeSlideId: scopeSlides[0].id, generatedType, slideType };
  }
  return { slides, scope, generated };
}

export function createSlideSequenceVocabularyPayload(scope, scopedVocabulary = []) {
  const seen = new Set();
  const items = [];
  for (const source of scopedVocabulary) {
    const id = String(source?.vocabularyId ?? "").trim();
    const term = String(source?.term ?? "").trim();
    if (!id || !term || seen.has(id)) continue;
    seen.add(id);
    const definitions = Array.isArray(source?.definitions)
      ? source.definitions.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];
    items.push({ id, term, definitions });
  }
  return {
    scope: scope ? { kind: scope.kind, ref: scope.ref } : null,
    items,
    summary: { total: items.length },
  };
}

function completionResults(outcome) {
  const evidence = record(outcome?.evidence);
  if (!evidence || Number(evidence.schemaVersion) !== 1 || !Array.isArray(evidence.results)) return null;
  if (evidence.results.length > 1000) return null;
  const results = [];
  for (const candidate of evidence.results) {
    const result = record(candidate);
    const rootSlideId = String(result?.rootSlideId ?? "").trim();
    const slideType = String(result?.slideType ?? "").trim();
    const itemId = String(result?.itemId ?? "").trim() || null;
    const status = String(result?.status ?? "").trim();
    if (!rootSlideId || rootSlideId.length > 160 || !slideType || slideType.length > 96
      || !new Set(["correct", "incorrect", "submitted"]).has(status)) return null;
    results.push({ rootSlideId, slideType, itemId, status });
  }
  return results;
}

export function verifySlideSequenceCompletion(exercise, outcome, scopedVocabulary = []) {
  const definition = resolveSlideSequenceDefinition(exercise);
  const results = completionResults(outcome);
  if (!results) return false;
  const expectedStatic = new Map();
  for (const slide of definition.slides) {
    if (UNSCORED_TYPES.has(slide.type)) continue;
    expectedStatic.set(slide.id, {
      slideType: slide.type,
      requiredStatus: SUBMITTED_TYPES.has(slide.type) ? "submitted" : "correct",
    });
  }
  const payload = createSlideSequenceVocabularyPayload(definition.scope, scopedVocabulary);
  const expectedItems = new Set(payload.items.map((item) => item.id));
  const satisfiedStatic = new Set();
  const satisfiedItems = new Set();
  for (const result of results) {
    const expected = expectedStatic.get(result.rootSlideId);
    if (expected) {
      if (result.itemId || result.slideType !== expected.slideType) return false;
      if (result.status === expected.requiredStatus) satisfiedStatic.add(result.rootSlideId);
      continue;
    }
    if (!definition.generated || !result.itemId || !expectedItems.has(result.itemId)) return false;
    if (result.slideType !== definition.generated.slideType
      || result.rootSlideId !== `${definition.generated.scopeSlideId}-${result.itemId}`) return false;
    if (result.status === "correct") satisfiedItems.add(result.itemId);
  }
  if (satisfiedStatic.size !== expectedStatic.size || satisfiedItems.size !== expectedItems.size) return false;
  if (definition.scope && expectedItems.size === 0) return false;
  return {
    evidenceType: SLIDE_SEQUENCE_COMPLETION_POLICY,
    evidenceRef: `exercise:${identifier(exercise.id, "exercise id")}:slides:${expectedStatic.size + expectedItems.size}`,
  };
}
