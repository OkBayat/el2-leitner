import { describe, expect, it } from 'vitest';
import {
  ListeningTest,
  buildListeningSubmission,
  countAnsweredListeningQuestions,
  splitListeningBlankPrompt,
} from './listening-practice';

const test: ListeningTest = {
  id: 'test-1',
  title: 'Test 1',
  position: 1,
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

  it('counts trimmed answers and emits a complete ordered test submission', () => {
    const values = { q1: ' day ', q2: '' };
    expect(countAnsweredListeningQuestions(test, values)).toBe(1);
    expect(buildListeningSubmission(test, values)).toEqual([
      { questionId: 'q1', value: ' day ' },
      { questionId: 'q2', value: '' },
    ]);
  });
});
