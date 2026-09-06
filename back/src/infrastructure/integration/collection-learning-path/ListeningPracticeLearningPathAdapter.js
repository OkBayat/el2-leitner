import {
  projectPublicListeningLesson,
  projectPublicListeningTest,
} from "../../../application/listening-practice/listeningPublicProjection.js";
import { LearningPathIeltsListeningReader } from "../../../application/collection-learning-path/ports/LearningPathIeltsListeningReader.js";
import { NotFoundError } from "../../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../../domain/listening-practice/ListeningProviders.js";

export class ListeningPracticeLearningPathAdapter extends LearningPathIeltsListeningReader {
  constructor({ listeningPracticeRepository }) {
    super();
    this.listeningPracticeRepository = listeningPracticeRepository;
  }

  async getPublishedTest(reference) {
    const lesson = await this.listeningPracticeRepository.findPublishedLessonBySlug(
      BBC_SIX_MINUTE_ENGLISH,
      reference.lessonSlug,
      { includeAnswers: false },
    );
    const test = lesson.tests.find((candidate) => candidate.id === reference.testId);
    if (!test) {
      throw new NotFoundError("LISTENING_TEST_NOT_FOUND", "Listening test was not found.");
    }
    return {
      reference: { lessonSlug: reference.lessonSlug, testId: reference.testId },
      lesson: projectPublicListeningLesson(lesson),
      test: projectPublicListeningTest(test),
    };
  }

  async findSubmittedAttempt(userId, attemptId) {
    return this.listeningPracticeRepository.findCompletedAttempt(userId, attemptId);
  }
}
