import { describe, expect, it } from 'vitest';
import {
  ListeningLesson,
  buildListeningSubmission,
  countAnsweredListeningQuestions,
  splitListeningBlankPrompt,
} from './listening-practice';

const lesson: ListeningLesson = {
  id: 'lesson-1',
  slug: 'lesson-1',
  title: 'Lesson',
  description: null,
  episodeCode: '1',
  episodeDate: '2026-09-03',
  sourceUrl: 'https://example.com',
  questionCount: 2,
  groups: [{
    id: 'group-1',
    position: 1,
    heading: 'Questions 1–2',
    taskType: 'note_completion',
    instruction: 'Complete the notes.',
    answerInstruction: 'Write one word.',
    maxWords: 1,
    maxNumbers: 0,
    questions: [
      { id: 'q1', number: 1, position: 1, responseType: 'text', prompt: 'Every {{blank}}.' },
      {
        id: 'q2',
        number: 2,
        position: 2,
        responseType: 'single_choice',
        prompt: 'Choose one.',
        options: [{ id: 'q2-a', label: 'A', text: 'First' }, { id: 'q2-b', label: 'B', text: 'Second' }],
      },
    ],
  }],
};

describe('listening practice domain helpers', () => {
  it('splits an inline IELTS completion prompt without using HTML injection', () => {
    expect(splitListeningBlankPrompt('Every {{blank}}.')).toEqual({ before: 'Every ', after: '.' });
    expect(() => splitListeningBlankPrompt('No blank')).toThrow(/exactly one blank/u);
  });

  it('counts trimmed answers and emits a complete ordered submission', () => {
    const values = { q1: ' day ', q2: '' };
    expect(countAnsweredListeningQuestions(lesson, values)).toBe(1);
    expect(buildListeningSubmission(lesson, values)).toEqual([
      { questionId: 'q1', value: ' day ' },
      { questionId: 'q2', value: '' },
    ]);
  });
});
