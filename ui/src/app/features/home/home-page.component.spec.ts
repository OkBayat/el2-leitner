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
  const refreshForLocalDay = vi.fn(async () => state()!);
  const loadCourses = vi.fn(async () => true);
  const loadJourneys = vi.fn(async () => true);
  const enter = vi.fn();
  let journeyView = courseView();
  const openOverview = vi.fn(async () => ({
    kind: 'path' as const,
    pathId: journeyView.path.id,
    collectionId: journeyView.path.collectionId,
  }));

  beforeEach(async () => {
    vi.clearAllMocks();
    state.set(stateWithDueReview(true));
    journeyView = courseView();
    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        provideRouter([
          { path: 'learning-paths/:pathId/lessons/:lessonId/exercises/:exerciseId', component: EmptyPage },
          { path: 'learning-paths/:pathId', component: EmptyPage },
          { path: 'library/:collectionId/learning-path', component: EmptyPage },
        ]),
        { provide: LearningStoreService, useValue: { state, initialize, refreshForLocalDay } },
        { provide: SelectedCoursesFacade, useValue: { courses, loading: courseLoading, error: courseError, load: loadCourses } },
        {
          provide: LibraryLearningPathJourneyFacade,
          useValue: { loading: signal(false), enteringId, error: journeyError, load: loadJourneys, enter, openOverview, viewFor: () => journeyView },
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
    expect(host.querySelector('#my-courses-heading')?.textContent).toContain('My Courses');
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

  it('opens the course overview without starting or resuming the course', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    const card = host.querySelector<HTMLButtonElement>('[data-testid="home-course-card"]');
    card?.click();
    await fixture.whenStable();
    expect(openOverview).toHaveBeenCalledWith(selectedCourse);
    expect(enter).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/library/cambridge-vocabulary-for-ielts/learning-path');
  });

  it('opens terminal courses canonically when route ids are available', async () => {
    const current = courseView();
    journeyView = { ...current, path: { ...current.path, id: '42' } };
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    host.querySelector<HTMLButtonElement>('[data-testid="home-course-card"]')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/learning-paths/42');
  });

  it('keeps terminal courses on the legacy collection route with an older backend', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    host.querySelector<HTMLButtonElement>('[data-testid="home-course-card"]')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url)
      .toBe('/library/cambridge-vocabulary-for-ielts/learning-path');
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
      expect(refreshForLocalDay).toHaveBeenCalledWith('2026-09-09');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retain a destroyed dashboard when its initial load finishes late', async () => {
    vi.useFakeTimers();
    let resolveInitialization!: (value: LearningState) => void;
    initialize.mockReturnValueOnce(new Promise((resolve) => { resolveInitialization = resolve; }));
    try {
      const fixture = TestBed.createComponent(HomePageComponent);
      fixture.detectChanges();
      fixture.destroy();
      resolveInitialization(state()!);
      await Promise.resolve();
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(refreshForLocalDay).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a failed midnight refresh through daily activation before clearing the error', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T23:59:59.900Z'));
    state.set(stateWithDueReview(false));
    refreshForLocalDay.mockRejectedValueOnce(new Error('temporarily offline'));
    try {
      const fixture = TestBed.createComponent(HomePageComponent);
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
      fixture.detectChanges();
      expect(fixture.componentInstance.reviewError()).toContain("Today's review could not load");

      refreshForLocalDay.mockImplementationOnce(async () => {
        const recovered = stateWithDueReview(true);
        state.set(recovered);
        return recovered;
      });
      const host: HTMLElement = fixture.nativeElement;
      host.querySelector<HTMLButtonElement>('[data-testid="review-load-error"] + button')?.click();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(refreshForLocalDay).toHaveBeenLastCalledWith('2026-09-09');
      expect(fixture.componentInstance.reviewError()).toBe('');
      expect(fixture.componentInstance.reviewCompleted()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="start-review"]')).not.toBeNull();
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
