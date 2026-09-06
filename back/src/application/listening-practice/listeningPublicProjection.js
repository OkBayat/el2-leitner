function publicQuestion(question) {
  const base = {
    id: question.id,
    number: question.number,
    position: question.position,
    responseType: question.responseType,
    prompt: question.prompt,
  };
  if (question.responseType === "single_choice") {
    return {
      ...base,
      options: question.options.map((option) => ({ id: option.id, label: option.label, text: option.text })),
    };
  }
  return base;
}

export function projectPublicListeningTest(test) {
  return {
    id: test.id,
    title: test.title,
    position: test.position,
    format: test.format || "ielts",
    difficulty: test.difficulty || "medium",
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
      questions: group.questions.map(publicQuestion),
    })),
  };
}

export function projectPublicListeningLesson(lesson) {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    description: lesson.description,
    episodeCode: lesson.episodeCode,
    episodeDate: lesson.episodeDate,
    sourceUrl: lesson.sourceUrl,
    level: lesson.level || "intermediate",
    imageUrl: lesson.imageFile ? `/api/listening/bbc/lessons/${encodeURIComponent(lesson.slug)}/image` : null,
    vocabularyCollectionId: lesson.vocabularyCollectionId || null,
    audioUrl: `/api/listening/bbc/lessons/${encodeURIComponent(lesson.slug)}/audio`,
    questionCount: lesson.questionCount,
    testCount: lesson.testCount,
  };
}
