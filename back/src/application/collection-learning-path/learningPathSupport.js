import {
  findProjectedExercise,
  findProjectedLesson,
  projectLearningPathProgress,
} from "../../domain/collection-learning-path/LearningPathProgression.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../domain/errors.js";

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

function ensurePublishedPath(path) {
  if (!path || path.status !== "published" || path.retiredAt != null) {
    throw new NotFoundError("LEARNING_PATH_NOT_FOUND", "Learning Path was not found.");
  }
  return path;
}

export async function loadPathById(definitionReader, rawPathId) {
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
  const lesson = findProjectedLesson(projected, id);
  if (!lesson) {
    throw new NotFoundError("LEARNING_PATH_LESSON_NOT_FOUND", "Learning Path lesson was not found.");
  }
  return lesson;
}

export function requireProjectedExercise(projectedLesson, rawExerciseId) {
  const id = exerciseId(rawExerciseId);
  const exercise = findProjectedExercise(projectedLesson, id);
  if (!exercise) {
    throw new NotFoundError("LEARNING_PATH_EXERCISE_NOT_FOUND", "Learning Path exercise was not found.");
  }
  return exercise;
}

export function isoTimestamp(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Learning Path clock returned an invalid timestamp.");
  return date.toISOString();
}
