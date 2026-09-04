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

const completedResult: ListeningAttemptResult = {
  attempt: {
    id: 'attempt-1',
    testId: 'test-2',
    status: 'completed',
    startedAt: '2026-09-03T08:00:00.000Z',
    submittedAt: '2026-09-03T08:06:00.000Z',
    totalQuestions: 2,
  },
  score: { correct: 0, wrong: 2, total: 2, percentage: 0 },
  results: [phraseMistake, choiceMistake],
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

  it('loads the selected test, marks existing House 1 mistakes and resets the same page for a retake', async () => {
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
    const restartingSignal = signal(false);
    const start = vi.fn().mockResolvedValue(true);
    const submit = vi.fn().mockImplementation(async () => {
      resultSignal.set(completedResult);
      attemptSignal.set(completedResult.attempt);
      return true;
    });
    const restart = vi.fn().mockImplementation(async () => {
      restartingSignal.set(true);
      attemptSignal.set({
        id: 'attempt-2',
        testId: 'test-2',
        status: 'active',
        startedAt: '2026-09-03T08:10:00.000Z',
        totalQuestions: 2,
      });
      resultSignal.set(null);
      restartingSignal.set(false);
      return true;
    });
    const findExistingHouseOneTerms = vi.fn().mockResolvedValue(new Set(['second option']));
    const addToHouseOne = vi.fn().mockResolvedValue({ id: 'db-sea-levels', term: 'sea levels', box: 1 });
    const session = {
      lesson: lessonSignal,
      test: testSignal,
      attempt: attemptSignal,
      result: resultSignal,
      loading: signal(false),
      submitting: signal(false),
      restarting: restartingSignal,
      error: signal<string | null>(null),
      start,
      submit,
      restart,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ListeningAttemptService, useValue: session },
        {
          provide: ListeningMistakePracticeService,
          useValue: { addToHouseOne, findExistingHouseOneTerms },
        },
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

    page.answerControl('q1').setValue('coast');
    page.answerControl('q2').setValue('q2-a');
    expect(page.answeredCount()).toBe(2);
    await page.submit();

    expect(submit).toHaveBeenCalledWith({ q1: 'coast', q2: 'q2-a' });
    expect(findExistingHouseOneTerms).toHaveBeenCalledWith(['sea levels', 'Second option']);
    expect(page.isVocabularyInHouseOne('SECOND OPTION')).toBe(true);
    expect(page.isVocabularyInHouseOne('sea levels')).toBe(false);
    expect(page.submitted()).toBe(true);
    expect(page.canSubmit()).toBe(false);

    const numericMistake = { ...phraseMistake, correctAnswer: '1C' };
    expect(page.vocabularyCandidate(phraseMistake)).toBe('sea levels');
    expect(page.vocabularyCandidate(choiceMistake)).toBe('Second option');
    expect(page.vocabularyCandidate(numericMistake)).toBeNull();

    await page.addVocabularyToHouseOne('sea levels');
    expect(addToHouseOne).toHaveBeenCalledWith('sea levels');
    expect(page.isVocabularyInHouseOne('SEA LEVELS')).toBe(true);

    await page.retake();

    expect(restart).toHaveBeenCalledTimes(1);
    expect(attemptSignal()?.id).toBe('attempt-2');
    expect(page.submitted()).toBe(false);
    expect(page.answerControl('q1').value).toBe('');
    expect(page.answerControl('q2').value).toBe('');
    expect(page.answeredCount()).toBe(0);
    expect(page.canSubmit()).toBe(true);
    expect(page.isVocabularyInHouseOne('sea levels')).toBe(false);
    expect(page.isVocabularyInHouseOne('Second option')).toBe(false);
  });
});
