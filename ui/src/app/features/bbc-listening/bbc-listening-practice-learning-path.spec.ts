import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningAttemptService } from '../../application/listening-practice/listening-attempt.service';
import { ListeningMistakePracticeService } from '../../application/listening-practice/listening-mistake-practice.service';
import { BbcListeningPracticePageComponent } from './bbc-listening-practice-page.component';

describe('BBC listening practice Learning Path adapter surface', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('prefers explicit lesson/test inputs over route parameters for embedded use', async () => {
    const start = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ListeningAttemptService,
          useValue: {
            lesson: signal(null),
            test: signal(null),
            attempt: signal(null),
            result: signal(null),
            loading: signal(false),
            submitting: signal(false),
            restarting: signal(false),
            error: signal(null),
            start,
          },
        },
        {
          provide: ListeningMistakePracticeService,
          useValue: { addToHouseOne: vi.fn(), findExistingHouseOneTerms: vi.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (name: string) => name === 'lessonSlug' ? 'route-lesson' : 'route-test' } },
          },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new BbcListeningPracticePageComponent());
    page.lessonSlug = 'learning-path-lesson';
    page.testId = 'test-4';
    page.embedded = true;

    await page.ngOnInit();

    expect(start).toHaveBeenCalledWith('learning-path-lesson', 'test-4');
    expect(page.routeError()).toBeNull();
  });
});
