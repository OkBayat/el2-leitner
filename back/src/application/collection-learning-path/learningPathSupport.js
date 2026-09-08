import {
  findProjectedExercise,
  findProjectedLesson,
  projectLearningPathProgress,
} from "../../domain/collection-learning-path/LearningPathProgression.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../domain/errors.js";

function identifier(value, code, message) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!normalized || normalized.length > 160) throw new ValidationError(code, message);
  return normalized;
}

export const learningPathId = (value) => identifier(
  value,
  "INVALID_LEARNING_PATH_ID",
  "A valid Learning Path id is required.",
);

export const collectionId = (value) => identifier(
  value,
  "INVALID_LEARNING_PATH_COLLECTION_ID",
  "A valid collection id is required.",
);

export const lessonId = (value) => identifier(
  value,
  "INVALID_LEARNING_PATH_LESSON_ID",
  "A valid Learning Path lesson id is required.",
);

export const exerciseId = (value) => identifier(
  value,
  "INVALID_LEARNING_PATH_EXERCISE_ID",
  "A valid Learning Path exercise id is required.",
);

export function routePublicId(value, codeName, label) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  const withinUnsignedBigInt = /^[1-9][0-9]{0,19}$/u.test(normalized)
    && BigInt(normalized) <= 18_446_744_073_709_551_615n;
  if (!withinUnsignedBigInt) {
    throw new ValidationError(
      `INVALID_${codeName}_PUBLIC_ID`,
      `${label} public id must be a positive decimal integer.`,
    );
  }
  return normalized;
}

export const resourcePublicId = (resource) => String(resource.publicId ?? resource.id);

function ensurePublishedPath(path) {
  if (!path || path.status !== "published" || path.retiredAt != null) {
    throw new NotFoundError("LEARNING_PATH_NOT_FOUND", "Learning Path was not found.");
  }
  return path;
}

export async function loadPathById(definitionReader, rawPathId) {
  const id = learningPathId(rawPathId);
  const path = typeof definitionReader.findByRoutePublicId === "function"
    ? await definitionReader.findByRoutePublicId(id)
    : await definitionReader.findByPublicId(id);
  return ensurePublishedPath(path);
}

export async function loadPathBySourceId(definitionReader, rawPathId) {
  const id = learningPathId(rawPathId);
  return ensurePublishedPath(await definitionReader.findByPublicId(id));
}

export async function loadPathByCollection(definitionReader, rawCollectionId) {
  const id = collectionId(rawCollectionId);
  return ensurePublishedPath(await definitionReader.findActiveByCollectionPublicId(id));
}

export async function ensureLearningPathReadAccess(accessReader, userId, path) {
  const access = await accessReader.getForCollection(userId, path.collectionId);
  if (!access?.canRead) {
    throw new ForbiddenError(
      "LEARNING_PATH_ACCESS_FORBIDDEN",
      "You do not have access to this Learning Path.",
    );
  }
  return access;
}

export async function ensureLearningPathProgressAccess(accessReader, userId, path) {
  const access = await ensureLearningPathReadAccess(accessReader, userId, path);
  if (!access.canProgress) {
    throw new ForbiddenError(
      "LEARNING_PATH_PROGRESS_FORBIDDEN",
      "Add this collection before starting its Learning Path.",
    );
  }
  return access;
}

export async function projectedPathForUser({ progressReader, userId, path }) {
  const progress = await progressReader.findForPath(userId, path.id);
  return {
    progress,
    projected: projectLearningPathProgress(path, progress),
  };
}

export function requireProjectedLesson(projected, rawLessonId) {
  const id = lessonId(rawLessonId);
  const lesson = projected.lessons.find(
    (candidate) => String(candidate.publicId ?? candidate.id) === id,
  ) ?? findProjectedLesson(projected, id);
  if (!lesson) {
    throw new NotFoundError("LEARNING_PATH_LESSON_NOT_FOUND", "Learning Path lesson was not found.");
  }
  return lesson;
}

export function requireProjectedExercise(projectedLesson, rawExerciseId) {
  const id = exerciseId(rawExerciseId);
  const exercise = projectedLesson?.exercises.find(
    (candidate) => String(candidate.publicId ?? candidate.id) === id,
  ) ?? findProjectedExercise(projectedLesson, id);
  if (!exercise) {
    throw new NotFoundError("LEARNING_PATH_EXERCISE_NOT_FOUND", "Learning Path exercise was not found.");
  }
  return exercise;
}

export function progressRevision(progress) {
  const raw = progress?.path?.revision ?? 0;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

export function expectedProgressRevision(value, currentProgress) {
  if (value == null) return progressRevision(currentProgress);
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new ValidationError(
      "INVALID_LEARNING_PATH_PROGRESS_REVISION",
      "Learning Path progress revision must be a non-negative integer.",
    );
  }
  return revision;
}

export function ensureProgressMutationAccepted(result) {
  if (result?.conflict) {
    throw new ConflictError(
      "LEARNING_PATH_PROGRESS_STALE",
      "Learning Path progress changed in another tab or request. Refresh and retry.",
    );
  }
  return result;
}

export function isoTimestamp(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Learning Path clock returned an invalid timestamp.");
  return date.toISOString();
}
