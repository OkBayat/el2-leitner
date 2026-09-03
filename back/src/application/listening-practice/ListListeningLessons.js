import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

function publicSummary(lesson) {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    description: lesson.description,
    episodeCode: lesson.episodeCode,
    episodeDate: lesson.episodeDate,
    sourceUrl: lesson.sourceUrl,
    questionCount: lesson.questionCount,
    testCount: lesson.testCount,
    tests: lesson.tests.map((test) => ({
      id: test.id,
      title: test.title,
      position: test.position,
      questionCount: test.questionCount,
      completed: test.completed,
      completedAt: test.completedAt
    }))
  };
}

export class ListListeningLessons {
  constructor({ listeningPracticeRepository }) {
    this.listeningPracticeRepository = listeningPracticeRepository;
  }

  async execute(userId) {
    const lessons = await this.listeningPracticeRepository.listPublishedLessons(BBC_SIX_MINUTE_ENGLISH, userId);
    return { provider: BBC_SIX_MINUTE_ENGLISH, lessons: lessons.map(publicSummary) };
  }
}
