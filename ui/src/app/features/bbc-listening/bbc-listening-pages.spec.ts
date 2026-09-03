import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningAttemptService } from '../../application/listening-practice/listening-attempt.service';
import { ListeningMistakePracticeService } from '../../application/listening-practice/listening-mistake-practice.service';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import type {
  ListeningAttempt,
  ListeningAttemptResult,
  ListeningLesson,
  ListeningLessonSummary,
  ListeningTest,
} from '../../domain/listening-practice/listening-practice';
import { BbcLessonsPageComponent } from './bbc-lessons-page.component';
import { BbcListeningPracticePageComponent } from './bbc-listening-practice-page.component';

const lesson: ListeningLesson = {
  id: 'bbc-lesson-1',
  slug: 'climate-change-extreme-weather',
  title: 'How is climate change affecting extreme weather?',
  description: 'A listening lesson.',
  episodeCode: '260903',
  episodeDate: '2026-09-03',
  sourceUrl: 'https://www.bbc.co.uk/example',
  audioUrl: '/api/listening/bbc/lessons/climate-change-extreme-weather/audio',
  questionCount: 39,
  testCount: 3,
};

const test: ListeningTest = {
  id: 'test-2',
  title: 'Test 2',
  position: 2,
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
        options: [
          { id: 'q2-a', label: 'A', text: 'First' },
          { id: 'q2-b', label: 'B', text: 'Second' },
        ],
      },
    ],
  }],
};

const lessonSummary: ListeningLessonSummary = {
  id: lesson.id,
  slug: lesson.slug,
  title: lesson.title,
  description: lesson.description,
  episodeCode: lesson.episodeCode,
  episodeDate: lesson.episodeDate,
  sourceUrl: lesson.sourceUrl,
  questionCount: lesson.questionCount,
  testCount: lesson.testCount,
  tests: [
    { id: 'test-1', title: 'Test 1', position: 1, questionCount: 13, completed: true, completedAt: '2026-09-03T08:00:00.000Z' },
    { id: 'test-2', title: 'Test 2', position: 2, questionCount: 13, completed: false, completedAt: null },
    { id: 'test-3', title: 'Test 3', position: 3, questionCount: 13, completed: false, completedAt: null },
  ],
};

describe('BBC listening pages', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the BBC lesson catalog with independent test completion state', async () => {
    const listBbcLessons = vi.fn().mockResolvedValue({
      provider: 'bbc_6_minute_english',
      lessons: [lessonSummary],
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ListeningPracticeApiService, useValue: { listBbcLessons } }],
    });
    const page = TestBed.runInInjectionContext(() => new BbcLessonsPageComponent());

    await page.ngOnInit();

    expect(listBbcLessons).toHaveBeenCalledTimes(1);
    expect(page.lessons()).toHaveLength(1);
    expect(page.lessons()[0].tests.map((item) => item.completed)).toEqual([true, false, false]);
    expect(page.loading()).toBe(false);
    expect(page.error()).toBeNull();
  });

  it('loads the selected test with its in-app audio, allows incomplete submission and can add mistakes to House 1', async () => {
    const lessonSignal = signal<ListeningLesson | null>(lesson);
    const testSignal = signal<ListeningTest | null>(test);
    const attemptSignal = signal<ListeningAttempt | null>({
      id: 'attempt-1',
      testId: 'test-2',
      status: 'active',
      startedAt: '2026-09-03T08:00:00.000Z',
      totalQuestions: 2,
    });
    const resultSignal = signal<ListeningAttemptResult | null>(null);
    const start = vi.fn().mockResolvedValue(true);
    const submit = vi.fn().mockResolvedValue(true);
    const addToHouseOne = vi.fn().mockResolvedValue({ id: 'db-sea-levels', term: 'sea levels', box: 1 });
    const session = {
      lesson: lessonSignal,
      test: testSignal,
      attempt: attemptSignal,
      result: resultSignal,
      loading: signal(false),
      submitting: signal(false),
      error: signal<string | null>(null),
      start,
      submit,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ListeningAttemptService, useValue: session },
        { provide: ListeningMistakePracticeService, useValue: { addToHouseOne } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (name: string) => name === 'lessonSlug' ? lesson.slug : name === 'testId' ? test.id : null,
              },
            },
          },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new BbcListeningPracticePageComponent());

    await page.ngOnInit();

    expect(start).toHaveBeenCalledWith(lesson.slug, test.id);
    expect(page.session.lesson()?.audioUrl).toBe('/api/listening/bbc/lessons/climate-change-extreme-weather/audio');
    expect(Object.keys(page.answers.controls)).toEqual(['q1', 'q2']);
    expect(page.answeredCount()).toBe(0);
    expect(page.canSubmit()).toBe(true);

    page.answerControl('q1').setValue('day');
    expect(page.answeredCount()).toBe(1);
    await page.submit();
    expect(submit).toHaveBeenCalledWith({ q1: 'day', q2: '' });

    const phraseMistake = {
      questionId: 'q1',
      number: 1,
      responseType: 'text' as const,
      correct: false,
      submittedAnswer: 'coast',
      correctAnswer: 'sea levels',
    };
    const choiceMistake = {
      questionId: 'q2',
      number: 2,
      responseType: 'single_choice' as const,
      correct: false,
      submittedAnswer: 'A. First',
      correctAnswer: 'B. Second option',
    };
    const numericMistake = { ...phraseMistake, correctAnswer: '1C' };

    expect(page.vocabularyCandidate(phraseMistake)).toBe('sea levels');
    expect(page.vocabularyCandidate(choiceMistake)).toBe('Second option');
    expect(page.vocabularyCandidate(numericMistake)).toBeNull();

    await page.addVocabularyToHouseOne('sea levels');
    expect(addToHouseOne).toHaveBeenCalledWith('sea levels');
    expect(page.isVocabularyAdded('SEA LEVELS')).toBe(true);
  });
});
