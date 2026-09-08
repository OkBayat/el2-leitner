import { ValidationError } from "../errors.js";
import {
  IELTS_LISTENING_COMPLETION_POLICY,
  IELTS_LISTENING_SCHEMA_VERSION,
  IELTS_LISTENING_TYPE,
} from "./IeltsListeningExercise.js";
import {
  VOCABULARY_INTAKE_COMPLETION_POLICY,
  VOCABULARY_INTAKE_SCHEMA_VERSION,
  VOCABULARY_INTAKE_TYPE,
} from "./VocabularyIntake.js";
import {
  VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
  VOCABULARY_QUICK_REVIEW_SCHEMA_VERSION,
  VOCABULARY_QUICK_REVIEW_TYPE,
} from "./ScopedVocabularyPractice.js";
import {
  VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY,
  VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION,
  VOCABULARY_MASTERY_CHECK_TYPE,
} from "./VocabularyMasteryCheck.js";

export const BBC_SIX_MINUTE_ENGLISH_PROVIDER = "bbc_6_minute_english";
const LISTENING_EPISODE_SCOPE = "listening-episode";
const MAX_PUBLIC_ID_LENGTH = 64;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export const BBC_SIX_MINUTE_ENGLISH_COURSE = Object.freeze({
  id: "bbc-six-minute-english",
  slug: "bbc-six-minute-english",
  title: "BBC 6 Minute English",
  description: "A rolling Vocora course built from BBC Learning English 6 Minute English episodes.",
  kind: "course",
  visibility: "public",
  status: "published",
  metadata: Object.freeze({
    managedBy: "collection-learning-path",
    provider: BBC_SIX_MINUTE_ENGLISH_PROVIDER,
    sourceKind: "listening-episode-catalog",
  }),
});

export const BBC_SIX_MINUTE_ENGLISH_PATH = Object.freeze({
  id: "bbc-six-minute-english-learning-path",
  collectionId: BBC_SIX_MINUTE_ENGLISH_COURSE.id,
  title: "BBC 6 Minute English",
  mode: "rolling",
  status: "published",
});

function invalid(message) {
  throw new ValidationError("INVALID_BBC_SIX_MINUTE_ENGLISH_COURSE_SOURCE", message);
}

function requiredText(value, label, maxLength = MAX_PUBLIC_ID_LENGTH) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) invalid(`${label} must be a non-empty string of at most ${maxLength} characters.`);
  return text;
}

function managedId(...parts) {
  const id = parts.map((part) => String(part ?? "").trim()).join("-");
  if (!id || id.length > MAX_PUBLIC_ID_LENGTH) {
    invalid(`Derived BBC Learning Path public id exceeds ${MAX_PUBLIC_ID_LENGTH} characters: ${id}`);
  }
  return id;
}

function lessonPosition(definition) {
  const episodeDate = requiredText(definition.episodeDate, `${definition.publicId} episodeDate`, 10);
  if (!DATE_PATTERN.test(episodeDate)) invalid(`${definition.publicId} episodeDate must use YYYY-MM-DD.`);
  const parsed = new Date(`${episodeDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== episodeDate) {
    invalid(`${definition.publicId} episodeDate must be a valid calendar date.`);
  }
  return Number(episodeDate.replaceAll("-", ""));
}

function vocabularyExercise(definition, kind, position, type, schemaVersion, completionPolicy) {
  return {
    id: managedId("bbc6", definition.publicId, kind),
    position,
    type,
    schemaVersion,
    required: true,
    completionPolicy,
    config: {
      scope: {
        kind: LISTENING_EPISODE_SCOPE,
        ref: definition.publicId,
      },
    },
  };
}

function listeningExercise(definition, test) {
  const testId = requiredText(test?.id, `${definition.publicId} test id`);
  const position = Number(test?.position);
  if (!Number.isSafeInteger(position) || position <= 0) {
    invalid(`${definition.publicId} ${testId} position must be a positive integer.`);
  }
  return {
    id: managedId("bbc6", definition.publicId, testId),
    position: 100 + position,
    type: IELTS_LISTENING_TYPE,
    schemaVersion: IELTS_LISTENING_SCHEMA_VERSION,
    required: true,
    completionPolicy: IELTS_LISTENING_COMPLETION_POLICY,
    config: {
      lessonSlug: requiredText(definition.slug, `${definition.publicId} slug`, 160),
      testId,
    },
  };
}

function publishedLesson(definition) {
  const publicId = requiredText(definition.publicId, "BBC episode publicId");
  const tests = Array.isArray(definition.tests) ? [...definition.tests] : [];
  if (!tests.length) invalid(`${publicId} must contain at least one listening test.`);
  tests.sort((left, right) => Number(left.position) - Number(right.position) || String(left.id).localeCompare(String(right.id)));
  const seenTests = new Set();
  for (const test of tests) {
    const testId = requiredText(test?.id, `${publicId} test id`);
    if (seenTests.has(testId)) invalid(`${publicId} contains duplicate test id ${testId}.`);
    seenTests.add(testId);
  }

  return {
    id: publicId,
    title: requiredText(definition.title, `${publicId} title`, 255),
    position: lessonPosition(definition),
    sourceKind: LISTENING_EPISODE_SCOPE,
    sourceRef: publicId,
    sourcePublishedAt: definition.publishedAt ?? null,
    exercises: [
      vocabularyExercise(
        definition,
        "vocab-intake",
        10,
        VOCABULARY_INTAKE_TYPE,
        VOCABULARY_INTAKE_SCHEMA_VERSION,
        VOCABULARY_INTAKE_COMPLETION_POLICY,
      ),
      vocabularyExercise(
        definition,
        "quick-review",
        20,
        VOCABULARY_QUICK_REVIEW_TYPE,
        VOCABULARY_QUICK_REVIEW_SCHEMA_VERSION,
        VOCABULARY_QUICK_REVIEW_COMPLETION_POLICY,
      ),
      vocabularyExercise(
        definition,
        "mastery-check",
        30,
        VOCABULARY_MASTERY_CHECK_TYPE,
        VOCABULARY_MASTERY_CHECK_SCHEMA_VERSION,
        VOCABULARY_MASTERY_CHECK_COMPLETION_POLICY,
      ),
      ...tests.map((test) => listeningExercise(definition, test)),
    ],
  };
}

function sourceProjection(episode) {
  if (episode.action === "retire") return { sourceRef: episode.sourceRef, action: episode.action };
  return {
    sourceRef: episode.sourceRef,
    action: episode.action,
    lesson: {
      id: episode.lesson.id,
      title: episode.lesson.title,
      position: episode.lesson.position,
      sourceKind: episode.lesson.sourceKind,
      sourceRef: episode.lesson.sourceRef,
      exercises: episode.lesson.exercises.map((exercise) => ({
        id: exercise.id,
        position: exercise.position,
        type: exercise.type,
        schemaVersion: exercise.schemaVersion,
        required: exercise.required,
        completionPolicy: exercise.completionPolicy,
        config: exercise.config,
      })),
    },
  };
}

export function isBbcSixMinuteEnglishManagedExercise(exercise) {
  return String(exercise?.id ?? "").startsWith("bbc6-bbc-6-minute-english-");
}

export function buildBbcSixMinuteEnglishCourseSource(listeningSources = []) {
  if (!Array.isArray(listeningSources)) invalid("Listening sources must be an array.");
  const definitions = listeningSources
    .map((source) => source?.definition)
    .filter((definition) => definition?.provider === BBC_SIX_MINUTE_ENGLISH_PROVIDER);

  const seenEpisodes = new Set();
  const seenPositions = new Set();
  const episodes = [];
  for (const definition of definitions) {
    const publicId = requiredText(definition?.publicId, "BBC episode publicId");
    if (seenEpisodes.has(publicId)) invalid(`Duplicate BBC episode publicId ${publicId}.`);
    seenEpisodes.add(publicId);

    if (definition.status === "archived") {
      episodes.push({ sourceRef: publicId, action: "retire" });
      continue;
    }
    if (definition.status !== "published") continue;

    const lesson = publishedLesson(definition);
    if (seenPositions.has(lesson.position)) invalid(`Duplicate BBC lesson position ${lesson.position}.`);
    seenPositions.add(lesson.position);
    episodes.push({ sourceRef: publicId, action: "publish", lesson });
  }

  episodes.sort((left, right) => {
    const leftPosition = left.lesson?.position ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = right.lesson?.position ?? Number.MAX_SAFE_INTEGER;
    return leftPosition - rightPosition || left.sourceRef.localeCompare(right.sourceRef);
  });

  return {
    course: BBC_SIX_MINUTE_ENGLISH_COURSE,
    path: BBC_SIX_MINUTE_ENGLISH_PATH,
    sourceCount: definitions.length,
    episodes,
    fingerprint: {
      provider: BBC_SIX_MINUTE_ENGLISH_PROVIDER,
      episodes: episodes.map(sourceProjection),
    },
  };
}
