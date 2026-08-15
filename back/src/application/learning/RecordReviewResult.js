import { ValidationError } from "../../domain/errors.js";

function nonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ValidationError("INVALID_REVIEW_RESULT", `${name} must be a non-negative integer.`);
  }
  return number;
}

function optionalDay(value, name) {
  if (value === null || value === undefined || value === "") return null;
  const day = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) {
    throw new ValidationError("INVALID_REVIEW_RESULT", `${name} must be a YYYY-MM-DD date.`);
  }
  return day;
}

function optionalIso(value, name) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ValidationError("INVALID_REVIEW_RESULT", `${name} must be a valid date-time.`);
  }
  return date.toISOString();
}

function requiredText(value, name, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) {
    throw new ValidationError("INVALID_REVIEW_RESULT", `${name} is required and must be at most ${maxLength} characters.`);
  }
  return text;
}

function optionalText(value, name, maxLength) {
  const text = String(value ?? "");
  if (text.length > maxLength) {
    throw new ValidationError("INVALID_REVIEW_RESULT", `${name} must be at most ${maxLength} characters.`);
  }
  return text;
}

function parseWord(input = {}) {
  const box = nonNegativeInteger(input.box, "word.box");
  if (box > 5) throw new ValidationError("INVALID_REVIEW_RESULT", "word.box must be between 0 and 5.");
  return {
    id: requiredText(input.id, "word.id", 64),
    box,
    due: optionalDay(input.due, "word.due"),
    attempts: nonNegativeInteger(input.attempts, "word.attempts"),
    correct: nonNegativeInteger(input.correct, "word.correct"),
    mistakes: nonNegativeInteger(input.mistakes, "word.mistakes"),
    currentStreak: nonNegativeInteger(input.currentStreak, "word.currentStreak"),
    introducedOn: optionalDay(input.introducedOn, "word.introducedOn"),
    addedSource: input.addedSource ? optionalText(input.addedSource, "word.addedSource", 64) : null,
    lastReviewed: optionalIso(input.lastReviewed, "word.lastReviewed"),
    lastPromotedDay: optionalDay(input.lastPromotedDay, "word.lastPromotedDay"),
    blockedUntil: optionalDay(input.blockedUntil, "word.blockedUntil"),
    masteredAt: optionalIso(input.masteredAt, "word.masteredAt")
  };
}

function parseEvent(input = {}, wordId) {
  const previousBox = input.previousBox === null || input.previousBox === undefined
    ? null
    : nonNegativeInteger(input.previousBox, "event.previousBox");
  const newBox = input.newBox === null || input.newBox === undefined
    ? null
    : nonNegativeInteger(input.newBox, "event.newBox");
  if (previousBox !== null && previousBox > 5) {
    throw new ValidationError("INVALID_REVIEW_RESULT", "event.previousBox must be between 0 and 5.");
  }
  if (newBox !== null && newBox > 5) {
    throw new ValidationError("INVALID_REVIEW_RESULT", "event.newBox must be between 0 and 5.");
  }
  const eventWordId = requiredText(input.wordId, "event.wordId", 64);
  if (eventWordId !== wordId) {
    throw new ValidationError("INVALID_REVIEW_RESULT", "event.wordId must match word.id.");
  }
  if (typeof input.correct !== "boolean" || typeof input.promoted !== "boolean") {
    throw new ValidationError("INVALID_REVIEW_RESULT", "event.correct and event.promoted must be booleans.");
  }
  return {
    at: optionalIso(input.at, "event.at") || new Date().toISOString(),
    day: optionalDay(input.day, "event.day") || "",
    wordId: eventWordId,
    term: requiredText(input.term, "event.term", 512),
    answer: optionalText(input.answer, "event.answer", 60000),
    correct: input.correct,
    mode: optionalText(input.mode || "review", "event.mode", 64),
    promoted: input.promoted,
    previousBox,
    newBox,
    mistakeNumber: input.mistakeNumber === null || input.mistakeNumber === undefined
      ? null
      : nonNegativeInteger(input.mistakeNumber, "event.mistakeNumber")
  };
}

function parseDaily(input = {}, eventDay) {
  if (!eventDay) throw new ValidationError("INVALID_REVIEW_RESULT", "event.day is required.");
  return {
    attempts: nonNegativeInteger(input.attempts, "daily.attempts"),
    correct: nonNegativeInteger(input.correct, "daily.correct"),
    wrong: nonNegativeInteger(input.wrong, "daily.wrong"),
    newAdded: nonNegativeInteger(input.newAdded, "daily.newAdded"),
    sessions: nonNegativeInteger(input.sessions, "daily.sessions"),
    durationSeconds: nonNegativeInteger(input.durationSeconds, "daily.durationSeconds")
  };
}

export class RecordReviewResult {
  constructor({ reviewProgressRepository }) {
    this.reviewProgressRepository = reviewProgressRepository;
  }

  async execute(userId, input = {}) {
    const expectedRevision = nonNegativeInteger(input.revision, "revision");
    const word = parseWord(input.word);
    const event = parseEvent(input.event, word.id);
    if (!event.day) throw new ValidationError("INVALID_REVIEW_RESULT", "event.day is required.");
    if (event.newBox !== null && event.newBox !== word.box) {
      throw new ValidationError("INVALID_REVIEW_RESULT", "event.newBox must match word.box.");
    }
    const daily = parseDaily(input.daily, event.day);
    const practiceSessionId = input.practiceSessionId
      ? requiredText(input.practiceSessionId, "practiceSessionId", 64)
      : null;

    const revision = await this.reviewProgressRepository.record(userId, {
      expectedRevision,
      word,
      event,
      daily,
      practiceSessionId
    });
    return { revision };
  }
}
