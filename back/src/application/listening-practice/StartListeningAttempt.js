import { NotFoundError, ValidationError } from "../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";
import {
  projectPublicListeningLesson,
  projectPublicListeningTest,
} from "./listeningPublicProjection.js";

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
      lesson: projectPublicListeningLesson(lesson),
      test: projectPublicListeningTest(selectedTest)
    };
  }
}

export { projectPublicListeningLesson, projectPublicListeningTest } from "./listeningPublicProjection.js";
