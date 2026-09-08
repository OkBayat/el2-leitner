import { describe, expect, it } from 'vitest';
import {
  canOpenLearningPathExercise,
  exerciseTypeLabel,
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

  it('opens only actionable exercises', () => {
    expect(canOpenLearningPathExercise(lessons[1].exercises[0])).toBe(true);
    expect(canOpenLearningPathExercise({ ...lessons[1].exercises[0], state: 'available' })).toBe(true);
    expect(canOpenLearningPathExercise({ ...lessons[1].exercises[0], state: 'locked' })).toBe(false);
    expect(canOpenLearningPathExercise({ ...lessons[1].exercises[0], state: 'completed' })).toBe(false);
  });

  it('provides stable human labels without coupling the shell to a renderer registry', () => {
    expect(exerciseTypeLabel('vocabulary.intake')).toBe('Vocabulary intake');
    expect(exerciseTypeLabel('slide-base')).toBe('Spelling practice');
    expect(exerciseTypeLabel('listening.ielts')).toBe('IELTS listening');
    expect(exerciseTypeLabel('custom.future-drill')).toBe('Future drill');
  });
});
