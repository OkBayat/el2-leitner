import { describe, expect, it } from 'vitest';
import type { CollectionLearningPathView, LearningPathLessonView } from '../collection-learning-path/learning-path';
import type { LibraryCollection } from '../learning/models';
import { buildHomeCourseCard } from './home-dashboard';

function course(overrides: Partial<LibraryCollection> = {}): LibraryCollection {
  return {
    id: 'cambridge-vocabulary-for-ielts',
    slug: 'cambridge-vocabulary-for-ielts',
    title: 'Cambridge Vocabulary for IELTS',
    kind: 'book',
    visibility: 'public',
    status: 'published',
    contentVersion: 1,
    wordCount: 100,
    subscribed: true,
    ...overrides,
  };
}

function lesson(
  id: string,
  state: LearningPathLessonView['state'],
  completedAt: string | null = null,
): LearningPathLessonView {
  return {
    id,
    title: id === 'lesson-1' ? 'Unit 1 · Growing up' : 'Unit 2 · Mental and physical development',
    position: Number(id.at(-1)),
    sourceKind: null,
    sourceRef: null,
    state,
    progress: null,
    exercises: [{
      id: `${id}-exercise`,
      position: 1,
      type: 'slide-base',
      schemaVersion: 1,
      required: true,
      completionPolicy: 'slide-completion',
      config: {},
      state: completedAt ? 'completed' : 'available',
      progress: completedAt ? {
        status: 'completed',
        startedAt: completedAt,
        completedAt,
        lastActivityAt: completedAt,
      } : null,
    }],
  };
}

function view(lessons: LearningPathLessonView[]): CollectionLearningPathView {
  return {
    access: { canProgress: true },
    resumePoint: { lessonId: 'lesson-2', exerciseId: 'lesson-2-exercise' },
    path: {
      id: 'cambridge-path',
      collectionId: 'cambridge-vocabulary-for-ielts',
      title: 'Cambridge Vocabulary for IELTS',
      mode: 'finite',
      status: 'published',
      contentVersion: '1',
      learnerStatus: 'in_progress',
      progress: null,
    },
    lessons,
  };
}

describe('home course cards', () => {
  it('uses the resume lesson and marks Done only from an exercise completed today', () => {
    const today = new Date(2026, 8, 8, 12).toISOString();
    const card = buildHomeCourseCard(course(), view([
      lesson('lesson-1', 'completed', new Date(2026, 8, 7, 12).toISOString()),
      lesson('lesson-2', 'in_progress', today),
    ]), '2026-09-08');

    expect(card).toMatchObject({
      collectionId: 'cambridge-vocabulary-for-ielts',
      title: 'Cambridge Vocabulary for IELTS',
      lessonTitle: 'Unit 2 · Mental and physical development',
      practicedToday: true,
      icon: 'words',
    });
  });

  it('does not let yesterday exercise completion or non-exercise progress mark today Done', () => {
    const prior = new Date(2026, 8, 7, 12).toISOString();
    const path = view([lesson('lesson-1', 'completed', prior), lesson('lesson-2', 'in_progress')]);
    path.lessons[1].progress = {
      status: 'in_progress',
      startedAt: new Date(2026, 8, 8, 12).toISOString(),
      completedAt: null,
      lastActivityAt: new Date(2026, 8, 8, 12).toISOString(),
    };

    expect(buildHomeCourseCard(course(), path, '2026-09-08').practicedToday).toBe(false);
  });

  it('uses a listening icon for listening courses and remains present while path data loads', () => {
    expect(buildHomeCourseCard(course({
      id: 'bbc-six-minute-english',
      slug: 'bbc-six-minute-english',
      title: 'BBC 6 Minute English',
      kind: 'course',
    }), null, '2026-09-08')).toMatchObject({
      lessonTitle: "Today's lesson",
      practicedToday: false,
      icon: 'listening',
    });
  });
});
