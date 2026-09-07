import { ValidationError } from "../errors.js";

export const FILE_MANAGED_LEARNING_PATH_SCHEMA_VERSION = 1;
export const FILE_MANAGED_LESSON_SOURCE_KIND = "collection-section";
export const LESSON_SOURCE_SCOPE_KIND = "lesson-source";

const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MANAGED_PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-$/u;
const PATH_MODES = new Set(["finite", "rolling"]);
const PATH_STATUSES = new Set(["draft", "published"]);

function invalid(message) {
  throw new ValidationError("INVALID_FILE_MANAGED_LEARNING_PATH_SOURCE", message);
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object.`);
  return value;
}

function identifier(value, label, max = 64) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max || !PUBLIC_ID_PATTERN.test(normalized)) {
    invalid(`${label} must be a lowercase hyphenated public id of at most ${max} characters.`);
  }
  return normalized;
}

function text(value, label, max = 255) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) invalid(`${label} must be non-empty and at most ${max} characters.`);
  return normalized;
}

function positiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) invalid(`${label} must be a positive integer.`);
  return normalized;
}

function booleanValue(value, label) {
  if (typeof value !== "boolean") invalid(`${label} must be a boolean.`);
  return value;
}

function jsonObject(value, label) {
  object(value, label);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    invalid(`${label} must contain JSON-compatible values only.`);
  }
}

function unique(items, selector, label) {
  const seen = new Set();
  for (const item of items) {
    const value = selector(item);
    if (seen.has(value)) invalid(`Duplicate ${label}: ${value}.`);
    seen.add(value);
  }
}

function parseExercise(raw, managedIdPrefix, lessonId) {
  const source = object(raw, `exercise in ${lessonId}`);
  const id = identifier(source.id, `exercise.id in ${lessonId}`);
  if (!id.startsWith(managedIdPrefix)) invalid(`exercise.id ${id} must start with managedIdPrefix ${managedIdPrefix}.`);
  const type = text(source.type, `exercise.type for ${id}`, 96);
  const completionPolicy = text(source.completionPolicy, `exercise.completionPolicy for ${id}`, 96);
  const config = jsonObject(source.config ?? {}, `exercise.config for ${id}`);
  if (config.scope?.kind === LESSON_SOURCE_SCOPE_KIND) {
    const scopeKeys = Object.keys(config.scope);
    if (scopeKeys.length !== 1) invalid(`exercise.config.scope for ${id} must use only kind=lesson-source.`);
  }
  return Object.freeze({
    id,
    position: positiveInteger(source.position, `exercise.position for ${id}`),
    type,
    schemaVersion: positiveInteger(source.schemaVersion, `exercise.schemaVersion for ${id}`),
    required: booleanValue(source.required, `exercise.required for ${id}`),
    completionPolicy,
    config,
  });
}

function parseLesson(raw, path, managedIdPrefix) {
  const source = object(raw, "lesson");
  const id = identifier(source.id, "lesson.id");
  if (!id.startsWith(managedIdPrefix)) invalid(`lesson.id ${id} must start with managedIdPrefix ${managedIdPrefix}.`);
  const lessonSource = object(source.source, `lesson.source for ${id}`);
  if (lessonSource.kind !== FILE_MANAGED_LESSON_SOURCE_KIND) {
    invalid(`lesson.source.kind for ${id} must be ${FILE_MANAGED_LESSON_SOURCE_KIND}.`);
  }
  const collectionId = identifier(lessonSource.collectionId, `lesson.source.collectionId for ${id}`);
  if (collectionId !== path.collectionId) {
    invalid(`lesson.source collection for ${id} must match path.collectionId ${path.collectionId}.`);
  }
  const exercises = Array.isArray(source.exercises)
    ? source.exercises.map((exercise) => parseExercise(exercise, managedIdPrefix, id))
    : invalid(`lesson.exercises for ${id} must be an array.`);
  unique(exercises, (exercise) => exercise.id, `exercise id in lesson ${id}`);
  unique(exercises, (exercise) => exercise.position, `exercise position in lesson ${id}`);
  exercises.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id, "en"));
  return Object.freeze({
    id,
    title: text(source.title, `lesson.title for ${id}`),
    position: positiveInteger(source.position, `lesson.position for ${id}`),
    source: Object.freeze({
      kind: FILE_MANAGED_LESSON_SOURCE_KIND,
      collectionId,
      sectionTitle: text(lessonSource.sectionTitle, `lesson.source.sectionTitle for ${id}`),
    }),
    exercises: Object.freeze(exercises),
  });
}

export function parseFileManagedLearningPathSource(raw) {
  const source = object(raw, "file-managed Learning Path source");
  if (Number(source.schemaVersion) !== FILE_MANAGED_LEARNING_PATH_SCHEMA_VERSION) {
    invalid(`schemaVersion must be ${FILE_MANAGED_LEARNING_PATH_SCHEMA_VERSION}.`);
  }
  const managedIdPrefix = String(source.managedIdPrefix ?? "").trim();
  if (!managedIdPrefix || managedIdPrefix.length > 24 || !MANAGED_PREFIX_PATTERN.test(managedIdPrefix)) {
    invalid("managedIdPrefix must be a lowercase hyphenated prefix ending in a hyphen and at most 24 characters.");
  }
  const rawPath = object(source.path, "path");
  const path = Object.freeze({
    id: identifier(rawPath.id, "path.id"),
    collectionId: identifier(rawPath.collectionId, "path.collectionId"),
    title: text(rawPath.title, "path.title"),
    mode: String(rawPath.mode ?? "").trim(),
    status: String(rawPath.status ?? "").trim(),
  });
  if (!path.id.startsWith(managedIdPrefix)) invalid(`path.id ${path.id} must start with managedIdPrefix ${managedIdPrefix}.`);
  if (!PATH_MODES.has(path.mode)) invalid("path.mode must be finite or rolling.");
  if (!PATH_STATUSES.has(path.status)) invalid("path.status must be draft or published.");

  const lessons = Array.isArray(source.lessons)
    ? source.lessons.map((lesson) => parseLesson(lesson, path, managedIdPrefix))
    : invalid("lessons must be an array.");
  unique(lessons, (lesson) => lesson.id, "lesson id");
  unique(lessons, (lesson) => lesson.position, "lesson position");
  lessons.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id, "en"));
  const exerciseIds = lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id));
  unique(exerciseIds, (id) => id, "exercise id");

  return Object.freeze({
    schemaVersion: FILE_MANAGED_LEARNING_PATH_SCHEMA_VERSION,
    managedIdPrefix,
    path,
    lessons: Object.freeze(lessons),
  });
}

export function validateFileManagedLearningPathSourceCatalog(definitions) {
  if (!Array.isArray(definitions)) invalid("Learning Path source catalog must be an array.");
  unique(definitions, (definition) => definition.path.id, "path id across managed files");
  unique(definitions, (definition) => definition.managedIdPrefix, "managedIdPrefix across managed files");
  const lessonOwners = new Map();
  const exerciseOwners = new Map();
  for (const definition of definitions) {
    for (const lesson of definition.lessons) {
      if (lessonOwners.has(lesson.id)) invalid(`Duplicate lesson id ${lesson.id} across managed files.`);
      lessonOwners.set(lesson.id, definition.path.id);
      for (const exercise of lesson.exercises) {
        if (exerciseOwners.has(exercise.id)) invalid(`Duplicate exercise id ${exercise.id} across managed files.`);
        exerciseOwners.set(exercise.id, definition.path.id);
      }
    }
  }
  return definitions;
}

export function isFileManagedLearningPathId(id, managedIdPrefix) {
  return String(id ?? "").startsWith(managedIdPrefix);
}

export function materializeLessonSourceScope(config, resolvedSource) {
  const cloned = jsonObject(config ?? {}, "exercise.config");
  if (cloned.scope?.kind !== LESSON_SOURCE_SCOPE_KIND) return cloned;
  cloned.scope = { kind: resolvedSource.kind, ref: resolvedSource.ref };
  return cloned;
}
