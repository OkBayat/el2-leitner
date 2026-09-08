import type { CollectionLearningPathView, LearningPathLessonView } from '../collection-learning-path/learning-path';
import { localDay } from '../learning/learning-rules';
import type { LibraryCollection } from '../learning/models';

export type HomeCourseIcon = 'listening' | 'words';

export interface HomeCourseCard {
  collectionId: string;
  title: string;
  lessonTitle: string;
  practicedToday: boolean;
  icon: HomeCourseIcon;
}

function activeLesson(view: CollectionLearningPathView): LearningPathLessonView | null {
  const resumeLesson = view.resumePoint
    ? view.lessons.find((lesson) => lesson.id === view.resumePoint?.lessonId)
    : null;
  return resumeLesson
    ?? view.lessons.find((lesson) => lesson.state === 'in_progress')
    ?? view.lessons.find((lesson) => lesson.state === 'available')
    ?? view.lessons.at(-1)
    ?? null;
}

function completedOnDay(lesson: LearningPathLessonView | null, today: string): boolean {
  return Boolean(lesson?.exercises.some((exercise) => {
    const completedAt = exercise.progress?.completedAt;
    if (!completedAt) return false;
    const completed = new Date(completedAt);
    return Number.isFinite(completed.valueOf()) && localDay(completed) === today;
  }));
}

export function buildHomeCourseCard(
  collection: LibraryCollection,
  view: CollectionLearningPathView | null,
  today: string,
): HomeCourseCard {
  const lesson = view ? activeLesson(view) : null;
  return {
    collectionId: collection.id,
    title: collection.title,
    lessonTitle: lesson?.title ?? "Today's lesson",
    practicedToday: completedOnDay(lesson, today),
    icon: collection.slug.includes('bbc') ? 'listening' : 'words',
  };
}
