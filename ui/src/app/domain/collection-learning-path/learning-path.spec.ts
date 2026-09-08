import { describe, expect, it } from 'vitest';
import {
  canOpenLearningPathExercise,
  exerciseTypeLabel,
  learningPathStartExerciseId,
  learningPathOverviewRoute,
  summarizeLearningPath,
  type LearningPathLessonView,
} from './learning-path';

const lessons: LearningPathLessonView[] = [
  {
    id: 'lesson-1', title: 'Lesson 1', position: 1, sourceKind: null, sourceRef: null,
    state: 'completed', progress: null,
    exercises: [
      { id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {}, state: 'completed', progress: null },
      { id: 'exercise-2', position: 2, type: 'bonus.optional', schemaVersion: 1, required: false, completionPolicy: 'explicit', config: {}, state: 'available', progress: null },
    ],
  },
  {
    id: 'lesson-2', title: 'Lesson 2', position: 2, sourceKind: null, sourceRef: null,
    state: 'in_progress', progress: null,
    exercises: [
      { id: 'exercise-3', position: 1, type: 'listening.ielts', schemaVersion: 1, required: true, completionPolicy: 'listening', config: {}, state: 'in_progress', progress: null },
      { id: 'exercise-4', position: 2, type: 'speaking.shadowing', schemaVersion: 1, required: true, completionPolicy: 'shadowing', config: {}, state: 'locked', progress: null },
    ],
  },
];

describe('Collection Learning Path UI domain', () => {
  it('summarizes required exercise progress without counting optional work', () => {
    expect(summarizeLearningPath(lessons)).toEqual({
      completedLessons: 1,
      totalLessons: 2,
      completedRequiredExercises: 1,
      totalRequiredExercises: 3,
      percent: 33,
    });
  });

  it('preserves completed progress for a legacy repeated run state', () => {
    const repeated = structuredClone(lessons);
    repeated[0].exercises[0].state = 'in_progress';
    repeated[0].exercises[0].progress = {
      status: 'in_progress',
      startedAt: '2026-09-08T10:00:00.000Z',
      completedAt: '2026-09-07T10:00:00.000Z',
      lastActivityAt: '2026-09-08T10:00:00.000Z',
    };

    expect(summarizeLearningPath(repeated).completedRequiredExercises).toBe(1);
  });

  it('opens only actionable exercises', () => {
    expect(canOpenLearningPathExercise(lessons[1].exercises[0])).toBe(true);
    expect(canOpenLearningPathExercise({ ...lessons[1].exercises[0], state: 'available' })).toBe(true);
    expect(canOpenLearningPathExercise({ ...lessons[1].exercises[0], state: 'locked' })).toBe(false);
    expect(canOpenLearningPathExercise({ ...lessons[1].exercises[0], state: 'completed' })).toBe(true);
    expect(canOpenLearningPathExercise({
      ...lessons[1].exercises[0],
      state: 'completed',
      config: { repeatable: false },
    })).toBe(false);
  });

  it('selects one start label only when no unfinished exercise needs continue', () => {
    expect(learningPathStartExerciseId(lessons)).toBeNull();

    const ready = structuredClone(lessons);
    ready[1].exercises[0].state = 'completed';
    ready[1].exercises[1].state = 'available';
    expect(learningPathStartExerciseId(ready)).toBe('exercise-4');

    ready[1].exercises[0].state = 'in_progress';
    ready[1].exercises[0].progress = {
      status: 'in_progress',
      startedAt: '2026-09-08T10:00:00.000Z',
      completedAt: '2026-09-07T10:00:00.000Z',
      lastActivityAt: '2026-09-08T10:00:00.000Z',
    };
    expect(learningPathStartExerciseId(ready)).toBe('exercise-4');
  });

  it('provides stable human labels without coupling the shell to a renderer registry', () => {
    expect(exerciseTypeLabel('vocabulary.intake')).toBe('Vocabulary intake');
    expect(exerciseTypeLabel('slides.sequence')).toBe('Slide sequence');
    expect(exerciseTypeLabel('slide-base')).toBe('Spelling practice');
    expect(exerciseTypeLabel('listening.ielts')).toBe('IELTS listening');
    expect(exerciseTypeLabel('custom.future-drill')).toBe('Future drill');
    expect(exerciseTypeLabel('slides.sequence', { title: 'Relationship collocations' }))
      .toBe('Relationship collocations');
    expect(exerciseTypeLabel('slides.sequence', { title: '   ' })).toBe('Slide sequence');
  });

  it('uses canonical overviews only for confirmed numeric ids during mixed deployments', () => {
    expect(learningPathOverviewRoute('1', 'course-1')).toEqual(['/learning-paths', '1']);
    expect(learningPathOverviewRoute('source-path', 'course-1'))
      .toEqual(['/library', 'course-1', 'learning-path']);
  });
});
