import { NotFoundError, ValidationError } from "../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

function lessonSlug(value) {
  const slug = typeof value === "string" ? value.trim() : "";
  if (!slug || slug.length > 160) {
    throw new ValidationError("INVALID_LISTENING_LESSON", "A valid listening lesson slug is required.");
  }
  return slug;
}

function testId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 64) {
    throw new ValidationError("INVALID_LISTENING_TEST", "A valid listening test id is required.");
  }
  return id;
}

function publicQuestion(question) {
  const base = {
    id: question.id,
    number: question.number,
    position: question.position,
    responseType: question.responseType,
    prompt: question.prompt
  };
  if (question.responseType === "single_choice") {
    return {
      ...base,
      options: question.options.map((option) => ({ id: option.id, label: option.label, text: option.text }))
    };
  }
  return base;
}

function publicTest(test) {
  return {
    id: test.id,
    title: test.title,
    position: test.position,
    questionCount: test.questionCount,
    groups: test.groups.map((group) => ({
      id: group.id,
      position: group.position,
      heading: group.heading,
      taskType: group.taskType,
      instruction: group.instruction,
      answerInstruction: group.answerInstruction,
      maxWords: group.maxWords,
      maxNumbers: group.maxNumbers,
      questions: group.questions.map(publicQuestion)
    }))
  };
}

function publicLesson(lesson) {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    description: lesson.description,
    episodeCode: lesson.episodeCode,
    episodeDate: lesson.episodeDate,
    sourceUrl: lesson.sourceUrl,
    questionCount: lesson.questionCount,
    testCount: lesson.testCount
  };
}

export class StartListeningAttempt {
  constructor({ listeningPracticeRepository }) {
    this.listeningPracticeRepository = listeningPracticeRepository;
  }

  async execute(userId, rawSlug, rawTestId) {
    const lesson = await this.listeningPracticeRepository.findPublishedLessonBySlug(
      BBC_SIX_MINUTE_ENGLISH,
      lessonSlug(rawSlug),
      { includeAnswers: false }
    );
    const selectedTestId = testId(rawTestId);
    const selectedTest = lesson.tests.find((candidate) => candidate.id === selectedTestId);
    if (!selectedTest) {
      throw new NotFoundError("LISTENING_TEST_NOT_FOUND", "Listening test was not found.");
    }
    const attempt = await this.listeningPracticeRepository.startAttempt(userId, lesson, selectedTest);
    return {
      attempt: {
        id: attempt.id,
        testId: attempt.testId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        totalQuestions: attempt.totalQuestions
      },
      lesson: publicLesson(lesson),
      test: publicTest(selectedTest)
    };
  }
}

export { publicLesson as projectPublicListeningLesson, publicTest as projectPublicListeningTest };
