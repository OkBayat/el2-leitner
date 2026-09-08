import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryLearningPathJourneyFacade } from '../../application/collection-learning-path/library-learning-path-journey.facade';
import { SelectedCoursesFacade } from '../../application/collection-learning-path/selected-courses.facade';
import { LearningStoreService } from '../../core/state/learning-store.service';
import type { CollectionLearningPathView } from '../../domain/collection-learning-path/learning-path';
import { createFreshState, localDay } from '../../domain/learning/learning-rules';
import type { LearningState, LibraryCollection } from '../../domain/learning/models';
import { HomePageComponent } from './home-page.component';

@Component({ template: '' })
class EmptyPage {}

const selectedCourse: LibraryCollection = {
  id: 'cambridge-vocabulary-for-ielts',
  slug: 'cambridge-vocabulary-for-ielts',
  title: 'Cambridge Vocabulary for IELTS',
  kind: 'book',
  visibility: 'public',
  status: 'published',
  contentVersion: 1,
  wordCount: 100,
  subscribed: true,
};

function courseView(): CollectionLearningPathView {
  const completedAt = new Date().toISOString();
  return {
    access: { canProgress: true },
    resumePoint: { lessonId: 'lesson-1', exerciseId: 'exercise-2' },
    path: {
      id: 'cambridge-path', collectionId: selectedCourse.id, title: selectedCourse.title,
      mode: 'finite', status: 'published', contentVersion: '1', learnerStatus: 'in_progress', progress: null,
    },
    lessons: [{
      id: 'lesson-1', title: 'Unit 1 · Growing up', position: 1, sourceKind: null, sourceRef: null,
      state: 'in_progress', progress: null,
      exercises: [
        {
          id: 'exercise-1', position: 1, type: 'slide-base', schemaVersion: 1, required: true,
          completionPolicy: 'slide-completion', config: {}, state: 'completed',
          progress: { status: 'completed', startedAt: completedAt, completedAt, lastActivityAt: completedAt },
        },
        {
          id: 'exercise-2', position: 2, type: 'slide-base', schemaVersion: 1, required: true,
          completionPolicy: 'slide-completion', config: {}, state: 'available', progress: null,
        },
      ],
    }],
  };
}

function stateWithDueReview(due: boolean): LearningState {
  const state = createFreshState(due ? [{ id: 'due', term: 'practice', box: 1, due: localDay(), introducedOn: localDay() }] : []);
  state.settings.dailyNew = 0;
  return state;
}

describe('HomePageComponent', () => {
  const state = signal<LearningState | null>(null);
  const courses = signal<LibraryCollection[]>([selectedCourse]);
  const courseLoading = signal(false);
  const courseError = signal('');
  const enteringId = signal<string | null>(null);
  const journeyError = signal('');
  const initialize = vi.fn(async () => state()!);
  const refreshCanonical = vi.fn(async () => state()!);
  const loadCourses = vi.fn(async () => true);
  const loadJourneys = vi.fn(async () => true);
  const enter = vi.fn(async () => ({
    kind: 'exercise' as const,
    pathId: 'cambridge-path',
    lessonId: 'lesson-1',
    exerciseId: 'exercise-2',
  }));

  beforeEach(async () => {
    vi.clearAllMocks();
    state.set(stateWithDueReview(true));
    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        provideRouter([{
          path: 'learning-path/:pathId/lessons/:lessonId/exercises/:exerciseId',
          component: EmptyPage,
        }]),
        { provide: LearningStoreService, useValue: { state, initialize, refreshCanonical } },
        { provide: SelectedCoursesFacade, useValue: { courses, loading: courseLoading, error: courseError, load: loadCourses } },
        {
          provide: LibraryLearningPathJourneyFacade,
          useValue: { loading: signal(false), enteringId, error: journeyError, load: loadJourneys, enter, viewFor: () => courseView() },
        },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(HomePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders one primary Leitner card and compact exercise-backed course status', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll('[data-testid="daily-review-card"]')).toHaveLength(1);
    expect(host.querySelector('[data-testid="daily-review-card"]')?.textContent).toContain('Your daily review is ready');
    expect(host.querySelector('[data-testid="start-review"]')?.textContent).toContain('Start Review');
    expect(host.querySelector('[data-testid="home-course-card"]')?.textContent).toContain('Unit 1 · Growing up');
    expect(host.querySelector('[data-testid="home-course-status"]')?.textContent).toContain('Done');
  });

  it('switches a completed daily review to free Leitner practice', async () => {
    state.set(stateWithDueReview(false));
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="daily-review-card"]')?.textContent).toContain("Today's review completed");
    expect(host.querySelector<HTMLAnchorElement>('[data-testid="practice-words"]')?.getAttribute('href')).toBe('/review?mode=box1');
  });

  it('opens the whole course card directly at its current exercise', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    const card = host.querySelector<HTMLButtonElement>('[data-testid="home-course-card"]');
    card?.click();
    await fixture.whenStable();
    expect(enter).toHaveBeenCalledWith(selectedCourse);
    expect(TestBed.inject(Router).url).toBe('/learning-path/cambridge-path/lessons/lesson-1/exercises/exercise-2');
  });

  it('keeps courses usable and reports the review error when state initialization fails', async () => {
    state.set(null);
    initialize.mockRejectedValueOnce(new Error('offline'));

    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;

    expect(fixture.componentInstance.reviewError()).toContain("Today's review could not load");
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="review-load-error"]')).not.toBeNull();
    expect(loadCourses).toHaveBeenCalledTimes(1);
    expect(loadJourneys).toHaveBeenCalledWith([selectedCourse]);
    expect(host.querySelector('[data-testid="home-course-card"]')).not.toBeNull();
  });

  it('refreshes review and exercise-day status after local midnight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T23:59:59.900Z'));
    try {
      state.set(stateWithDueReview(true));
      const fixture = TestBed.createComponent(HomePageComponent);
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      expect(fixture.componentInstance.today()).toBe('2026-09-08');

      await vi.advanceTimersByTimeAsync(100);

      expect(fixture.componentInstance.today()).toBe('2026-09-09');
      expect(refreshCanonical).toHaveBeenCalledTimes(1);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
