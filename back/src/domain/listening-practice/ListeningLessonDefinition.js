import { ValidationError } from "../errors.js";
import { normalizeListeningAnswer } from "./ListeningAnswerNormalizer.js";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u;
const PROVIDER_PATTERN = /^[a-z0-9_]{3,64}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const BLANK_TOKEN = "{{blank}}";
const TASK_TYPES = new Set([
  "note_completion",
  "multiple_choice_single",
  "sentence_completion",
  "short_answer"
]);
const RESPONSE_TYPES = new Set(["text", "single_choice"]);

function fail(sourceName, message) {
  throw new ValidationError("INVALID_LISTENING_LESSON", `${sourceName}: ${message}`);
}

function object(value, sourceName, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(sourceName, `${label} must be an object.`);
  return value;
}

function string(value, sourceName, label, { max = 1000, pattern = null } = {}) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) fail(sourceName, `${label} is required.`);
  if (result.length > max) fail(sourceName, `${label} must be at most ${max} characters.`);
  if (pattern && !pattern.test(result)) fail(sourceName, `${label} has an invalid format.`);
  return result;
}

function optionalString(value, sourceName, label, options = {}) {
  if (value === null || value === undefined || value === "") return null;
  return string(value, sourceName, label, options);
}

function positiveInteger(value, sourceName, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) fail(sourceName, `${label} must be a positive integer.`);
  return result;
}

function optionalNonNegativeInteger(value, sourceName, label) {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) fail(sourceName, `${label} must be a non-negative integer or null.`);
  return result;
}

function array(value, sourceName, label) {
  if (!Array.isArray(value) || value.length === 0) fail(sourceName, `${label} must be a non-empty array.`);
  return value;
}

function assertSequential(values, sourceName, label) {
  const sorted = [...values].sort((left, right) => left - right);
  sorted.forEach((value, index) => {
    if (value !== index + 1) fail(sourceName, `${label} must be sequential starting at 1.`);
  });
}

function countToken(text, token) {
  return text.split(token).length - 1;
}

function parseOption(raw, sourceName, questionLabel, optionIds, labels) {
  const input = object(raw, sourceName, `${questionLabel} option`);
  const id = string(input.id, sourceName, `${questionLabel} option id`, { max: 64, pattern: ID_PATTERN });
  const label = string(input.label, sourceName, `${questionLabel} option label`, { max: 8 }).toUpperCase();
  const text = string(input.text, sourceName, `${questionLabel} option text`, { max: 1000 });
  if (optionIds.has(id)) fail(sourceName, `Option id ${id} is duplicated.`);
  if (labels.has(label)) fail(sourceName, `${questionLabel} has duplicate option label ${label}.`);
  optionIds.add(id);
  labels.add(label);
  return { id, label, text };
}

function parseQuestion(raw, sourceName, ids) {
  const input = object(raw, sourceName, "question");
  const id = string(input.id, sourceName, "question id", { max: 64, pattern: ID_PATTERN });
  if (ids.questionIds.has(id)) fail(sourceName, `Question id ${id} is duplicated.`);
  ids.questionIds.add(id);

  const number = positiveInteger(input.number, sourceName, `${id} number`);
  const position = positiveInteger(input.position, sourceName, `${id} position`);
  const responseType = string(input.responseType, sourceName, `${id} responseType`, { max: 32 });
  if (!RESPONSE_TYPES.has(responseType)) fail(sourceName, `${id} has unsupported responseType ${responseType}.`);
  const prompt = string(input.prompt, sourceName, `${id} prompt`, { max: 4000 });

  if (responseType === "text") {
    if (countToken(prompt, BLANK_TOKEN) !== 1) fail(sourceName, `${id} text prompt must contain exactly one ${BLANK_TOKEN} token.`);
    const seen = new Set();
    const acceptedAnswers = array(input.answers, sourceName, `${id} answers`).map((answer, index) => {
      const text = string(answer, sourceName, `${id} answer ${index + 1}`, { max: 512 });
      const normalized = normalizeListeningAnswer(text);
      if (!normalized) fail(sourceName, `${id} answer ${index + 1} is empty after normalization.`);
      if (seen.has(normalized)) fail(sourceName, `${id} contains a duplicate accepted answer.`);
      seen.add(normalized);
      return { text, normalized, primary: index === 0 };
    });
    return { id, number, position, responseType, prompt, acceptedAnswers };
  }

  if (countToken(prompt, BLANK_TOKEN) !== 0) fail(sourceName, `${id} choice prompt cannot contain ${BLANK_TOKEN}.`);
  const labels = new Set();
  const options = array(input.options, sourceName, `${id} options`).map((option) =>
    parseOption(option, sourceName, id, ids.optionIds, labels)
  );
  if (options.length < 2 || options.length > 6) fail(sourceName, `${id} must contain between 2 and 6 options.`);
  const answerLabel = string(input.answer, sourceName, `${id} answer`, { max: 8 }).toUpperCase();
  const correctOption = options.find((option) => option.label === answerLabel);
  if (!correctOption) fail(sourceName, `${id} answer label ${answerLabel} does not match an option.`);
  return { id, number, position, responseType, prompt, options, correctOptionId: correctOption.id };
}

function parseGroup(raw, sourceName, ids) {
  const input = object(raw, sourceName, "question group");
  const id = string(input.id, sourceName, "question group id", { max: 64, pattern: ID_PATTERN });
  if (ids.groupIds.has(id)) fail(sourceName, `Question group id ${id} is duplicated.`);
  ids.groupIds.add(id);
  const position = positiveInteger(input.position, sourceName, `${id} position`);
  const taskType = string(input.taskType, sourceName, `${id} taskType`, { max: 64 });
  if (!TASK_TYPES.has(taskType)) fail(sourceName, `${id} has unsupported taskType ${taskType}.`);
  const heading = string(input.heading, sourceName, `${id} heading`, { max: 255 });
  const instruction = string(input.instruction, sourceName, `${id} instruction`, { max: 1000 });
  const answerInstruction = string(input.answerInstruction, sourceName, `${id} answerInstruction`, { max: 1000 });
  const maxWords = optionalNonNegativeInteger(input.maxWords, sourceName, `${id} maxWords`);
  const maxNumbers = optionalNonNegativeInteger(input.maxNumbers, sourceName, `${id} maxNumbers`);
  const questions = array(input.questions, sourceName, `${id} questions`).map((question) =>
    parseQuestion(question, sourceName, ids)
  );
  assertSequential(questions.map((question) => question.position), sourceName, `${id} question positions`);
  const expectedResponseType = taskType === "multiple_choice_single" ? "single_choice" : "text";
  if (questions.some((question) => question.responseType !== expectedResponseType)) {
    fail(sourceName, `${id} questions must use responseType ${expectedResponseType}.`);
  }
  return { id, position, heading, taskType, instruction, answerInstruction, maxWords, maxNumbers, questions };
}

export function parseListeningLessonDefinition(raw, sourceName = "listening lesson") {
  const input = object(raw, sourceName, "lesson");
  if (Number(input.schemaVersion) !== 1) fail(sourceName, "schemaVersion must be 1.");

  const publicId = string(input.publicId, sourceName, "publicId", { max: 64, pattern: ID_PATTERN });
  const provider = string(input.provider, sourceName, "provider", { max: 64, pattern: PROVIDER_PATTERN });
  const slug = string(input.slug, sourceName, "slug", { max: 160, pattern: SLUG_PATTERN });
  const title = string(input.title, sourceName, "title", { max: 255 });
  const description = optionalString(input.description, sourceName, "description", { max: 4000 });
  const episodeCode = optionalString(input.episodeCode, sourceName, "episodeCode", { max: 64 });
  const episodeDate = optionalString(input.episodeDate, sourceName, "episodeDate", { max: 10, pattern: DATE_PATTERN });
  const sourceUrl = string(input.sourceUrl, sourceName, "sourceUrl", { max: 1000 });
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    fail(sourceName, "sourceUrl must be a valid URL.");
  }
  if (parsedUrl.protocol !== "https:") fail(sourceName, "sourceUrl must use HTTPS.");
  const status = optionalString(input.status, sourceName, "status", { max: 32 }) || "draft";
  if (!new Set(["draft", "published", "archived"]).has(status)) fail(sourceName, `status ${status} is not supported.`);
  const publishedAt = optionalString(input.publishedAt, sourceName, "publishedAt", { max: 40 });
  if (publishedAt && Number.isNaN(Date.parse(publishedAt))) fail(sourceName, "publishedAt must be an ISO date-time.");

  const ids = { groupIds: new Set(), questionIds: new Set(), optionIds: new Set() };
  const groups = array(input.groups, sourceName, "groups").map((group) => parseGroup(group, sourceName, ids));
  assertSequential(groups.map((group) => group.position), sourceName, "group positions");
  const questions = groups.flatMap((group) => group.questions);
  assertSequential(questions.map((question) => question.number), sourceName, "question numbers");

  return {
    schemaVersion: 1,
    publicId,
    provider,
    slug,
    title,
    description,
    episodeCode,
    episodeDate,
    sourceUrl,
    status,
    publishedAt,
    questionCount: questions.length,
    groups
  };
}

export function flattenListeningQuestions(lesson) {
  return lesson.groups.flatMap((group) => group.questions.map((question) => ({ ...question, group })));
}

export { BLANK_TOKEN };
