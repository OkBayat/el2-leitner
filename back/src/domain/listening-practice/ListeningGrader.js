import { ValidationError } from "../errors.js";
import { normalizeListeningAnswer } from "./ListeningAnswerNormalizer.js";
import { flattenListeningQuestions } from "./ListeningLessonDefinition.js";

const MAX_ANSWER_LENGTH = 1000;

function parseSubmittedAnswers(rawAnswers, questions) {
  if (!Array.isArray(rawAnswers)) {
    throw new ValidationError("INVALID_LISTENING_SUBMISSION", "answers must be an array.");
  }
  if (rawAnswers.length > questions.length) {
    throw new ValidationError("INVALID_LISTENING_SUBMISSION", "The submission contains too many answers.");
  }

  const knownQuestionIds = new Set(questions.map((question) => question.id));
  const answers = new Map();
  for (const raw of rawAnswers) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ValidationError("INVALID_LISTENING_SUBMISSION", "Each answer must be an object.");
    }
    const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
    if (!knownQuestionIds.has(questionId)) {
      throw new ValidationError("INVALID_LISTENING_SUBMISSION", "The submission contains an unknown question.");
    }
    if (answers.has(questionId)) {
      throw new ValidationError("INVALID_LISTENING_SUBMISSION", "A question was answered more than once.");
    }
    if (typeof raw.value !== "string") {
      throw new ValidationError("INVALID_LISTENING_SUBMISSION", "Each answer value must be text.");
    }
    if (raw.value.length > MAX_ANSWER_LENGTH) {
      throw new ValidationError(
        "INVALID_LISTENING_SUBMISSION",
        `Each answer must be at most ${MAX_ANSWER_LENGTH} characters.`
      );
    }
    answers.set(questionId, raw.value);
  }
  return answers;
}

function displayOption(option) {
  return option ? `${option.label}. ${option.text}` : "No answer";
}

function gradeTextQuestion(question, rawValue) {
  const submitted = String(rawValue ?? "").trim();
  const normalized = normalizeListeningAnswer(submitted);
  const correct = Boolean(normalized)
    && question.acceptedAnswers.some((answer) => answer.normalized === normalized);
  const primary = question.acceptedAnswers.find((answer) => answer.primary) || question.acceptedAnswers[0];
  return {
    correct,
    submittedValue: submitted,
    submittedAnswer: submitted || "No answer",
    correctAnswer: primary.text
  };
}

function gradeChoiceQuestion(question, rawValue) {
  const submittedValue = String(rawValue ?? "").trim();
  const selectedOption = question.options.find((option) => option.id === submittedValue) || null;
  if (submittedValue && !selectedOption) {
    throw new ValidationError("INVALID_LISTENING_SUBMISSION", "A selected option does not belong to its question.");
  }
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);
  if (!correctOption) {
    throw new ValidationError("INVALID_LISTENING_LESSON", "A listening question has no valid correct option.");
  }
  return {
    correct: selectedOption?.id === correctOption.id,
    submittedValue,
    submittedAnswer: displayOption(selectedOption),
    correctAnswer: displayOption(correctOption)
  };
}

export function gradeListeningAttempt(lesson, rawAnswers) {
  const questions = flattenListeningQuestions(lesson);
  const answers = parseSubmittedAnswers(rawAnswers, questions);
  const results = questions
    .sort((left, right) => left.number - right.number)
    .map((question) => {
      const rawValue = answers.get(question.id) ?? "";
      const graded = question.responseType === "text"
        ? gradeTextQuestion(question, rawValue)
        : gradeChoiceQuestion(question, rawValue);
      return {
        questionId: question.id,
        number: question.number,
        responseType: question.responseType,
        ...graded
      };
    });
  const correct = results.filter((result) => result.correct).length;
  const total = results.length;
  return {
    score: {
      correct,
      wrong: total - correct,
      total,
      percentage: total ? Number(((correct / total) * 100).toFixed(1)) : 0
    },
    results
  };
}
