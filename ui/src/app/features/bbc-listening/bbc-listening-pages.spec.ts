import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningAttemptService } from '../../application/listening-practice/listening-attempt.service';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import type {
  ListeningAttempt,
  ListeningAttemptResult,
  ListeningLesson,
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

const { groups: _groups, ...lessonSummary } = lesson;

describe('BBC listening pages', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the BBC lesson catalog through the query service', async () => {
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
    expect(page.loading()).toBe(false);
    expect(page.error()).toBeNull();
  });

  it('creates one typed control per question and submits only when all are answered', async () => {
    const lessonSignal = signal<ListeningLesson | null>(lesson);
    const attemptSignal = signal<ListeningAttempt | null>({
      id: 'attempt-1',
      status: 'active',
      startedAt: '2026-09-03T08:00:00.000Z',
      totalQuestions: 2,
    });
    const resultSignal = signal<ListeningAttemptResult | null>(null);
    const start = vi.fn().mockResolvedValue(true);
    const submit = vi.fn().mockResolvedValue(true);
    const session = {
      lesson: lessonSignal,
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
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (name: string) => name === 'lessonSlug' ? lesson.slug : null } } },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new BbcListeningPracticePageComponent());

    await page.ngOnInit();

    expect(start).toHaveBeenCalledWith(lesson.slug);
    expect(Object.keys(page.answers.controls)).toEqual(['q1', 'q2']);
    expect(page.canSubmit()).toBe(false);

    page.answerControl('q1').setValue('day');
    page.answerControl('q2').setValue('q2-b');
    expect(page.answeredCount()).toBe(2);
    expect(page.canSubmit()).toBe(true);

    await page.submit();
    expect(submit).toHaveBeenCalledWith({ q1: 'day', q2: 'q2-b' });
  });
});
