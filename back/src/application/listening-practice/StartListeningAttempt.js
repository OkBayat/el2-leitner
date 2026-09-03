import { ValidationError } from "../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

function lessonSlug(value) {
  const slug = typeof value === "string" ? value.trim() : "";
  if (!slug || slug.length > 160) {
    throw new ValidationError("INVALID_LISTENING_LESSON", "A valid listening lesson slug is required.");
  }
  return slug;
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
    groups: lesson.groups.map((group) => ({
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

export class StartListeningAttempt {
  constructor({ listeningPracticeRepository }) {
    this.listeningPracticeRepository = listeningPracticeRepository;
  }

  async execute(userId, rawSlug) {
    const lesson = await this.listeningPracticeRepository.findPublishedLessonBySlug(
      BBC_SIX_MINUTE_ENGLISH,
      lessonSlug(rawSlug),
      { includeAnswers: false }
    );
    const attempt = await this.listeningPracticeRepository.startAttempt(userId, lesson);
    return {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        totalQuestions: attempt.totalQuestions
      },
      lesson: publicLesson(lesson)
    };
  }
}

export { publicLesson as projectPublicListeningLesson };
