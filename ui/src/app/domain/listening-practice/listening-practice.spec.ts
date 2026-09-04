import { describe, expect, it } from 'vitest';
import {
  ListeningTest,
  buildListeningAudioProgress,
  buildListeningSubmission,
  countAnsweredListeningQuestions,
  splitListeningBlankPrompt,
} from './listening-practice';

const textQuestion = (number: number) => ({
  id: `q${number}`,
  number,
  position: number,
  responseType: 'text' as const,
  prompt: `Question ${number} {{blank}}.`,
});

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

const timelineTest: ListeningTest = {
  id: 'timeline-test',
  title: 'Timeline Test',
  position: 1,
  questionCount: 13,
  groups: [
    {
      id: 'group-1',
      position: 1,
      heading: 'Questions 1–4',
      taskType: 'note_completion',
      instruction: 'Complete the notes.',
      answerInstruction: 'Write one word.',
      maxWords: 1,
      maxNumbers: 0,
      questions: [1, 2, 3, 4].map(textQuestion),
    },
    {
      id: 'group-2',
      position: 2,
      heading: 'Questions 5–7',
      taskType: 'sentence_completion',
      instruction: 'Complete the sentences.',
      answerInstruction: 'Write one word.',
      maxWords: 1,
      maxNumbers: 0,
      questions: [5, 6, 7].map(textQuestion),
    },
    {
      id: 'group-3',
      position: 3,
      heading: 'Questions 8–10',
      taskType: 'short_answer',
      instruction: 'Answer the questions.',
      answerInstruction: 'Write up to three words.',
      maxWords: 3,
      maxNumbers: 0,
      questions: [8, 9, 10].map(textQuestion),
    },
    {
      id: 'group-4',
      position: 4,
      heading: 'Questions 11–13',
      taskType: 'short_answer',
      instruction: 'Answer the questions.',
      answerInstruction: 'Write up to three words.',
      maxWords: 3,
      maxNumbers: 0,
      questions: [11, 12, 13].map(textQuestion),
    },
  ],
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

  it('projects ordered IELTS question groups onto an approximate audio timeline', () => {
    const start = buildListeningAudioProgress(timelineTest, 0, 390);
    expect(start.progress).toBe(0);
    expect(start.currentRangeLabel).toBe('Questions 1–4');
    expect(start.activeSegmentId).toBe('group-1');
    expect(start.segments.map((segment) => ({
      id: segment.id,
      label: segment.label,
      questionCount: segment.questionCount,
      startProgress: segment.startProgress,
      endProgress: segment.endProgress,
    }))).toEqual([
      { id: 'group-1', label: 'Q1–4', questionCount: 4, startProgress: 0, endProgress: 4 / 13 },
      { id: 'group-2', label: 'Q5–7', questionCount: 3, startProgress: 4 / 13, endProgress: 7 / 13 },
      { id: 'group-3', label: 'Q8–10', questionCount: 3, startProgress: 7 / 13, endProgress: 10 / 13 },
      { id: 'group-4', label: 'Q11–13', questionCount: 3, startProgress: 10 / 13, endProgress: 1 },
    ]);

    const middle = buildListeningAudioProgress(timelineTest, 156, 390);
    expect(middle.progress).toBe(0.4);
    expect(middle.currentRangeLabel).toBe('Questions 5–7');
    expect(middle.activeSegmentId).toBe('group-2');

    const beyondEnd = buildListeningAudioProgress(timelineTest, 999, 390);
    expect(beyondEnd.progress).toBe(1);
    expect(beyondEnd.currentRangeLabel).toBe('Questions 11–13');
    expect(beyondEnd.activeSegmentId).toBe('group-4');
  });
});
