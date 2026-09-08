import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseRunnerFacade } from '../../../application/collection-learning-path/exercise-runner.facade';
import type { ExerciseContextView } from '../../../domain/collection-learning-path/learning-path';
import { ExerciseRunnerPageComponent } from './exercise-runner-page.component';

const completedContext: ExerciseContextView = {
  path: { id: 'path-1', collectionId: 'course-1', title: 'Course', mode: 'rolling', contentVersion: '1' },
  lesson: { id: 'episode-1', title: 'Episode 1', position: 1 },
  exercise: {
    id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true,
    completionPolicy: 'vocabulary-intake', config: {},
  },
  progress: { status: 'completed', startedAt: '2026-09-06T20:00:00.000Z', completedAt: '2026-09-06T20:01:00.000Z', lastActivityAt: '2026-09-06T20:01:00.000Z' },
  state: 'completed',
  payload: null,
};

function setup(resumePoint: { lessonId: string; exerciseId: string } | null, pathStatus: 'in_progress' | 'up_to_date') {
  const facade = {
    context: signal(completedContext),
    resume: signal({ pathId: 'path-1', pathStatus, resumePoint }),
    loading: signal(false),
    error: signal(''),
    load: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue(true),
  };
  TestBed.configureTestingModule({
    imports: [ExerciseRunnerPageComponent],
    providers: [
      provideRouter([]),
      { provide: ExerciseRunnerFacade, useValue: facade },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: 'path-1', lessonId: 'episode-1', exerciseId: 'exercise-1' })) } },
    ],
  });
  return { facade, fixture: TestBed.createComponent(ExerciseRunnerPageComponent) };
}

describe('ExerciseRunnerPageComponent journey continuation', () => {
  it('continues to the exact server-derived next exercise after completion', async () => {
    const { fixture } = setup({ lessonId: 'episode-2', exerciseId: 'exercise-2' }, 'in_progress');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((item) => item.textContent?.trim() === 'Continue');
    expect(button).toBeTruthy();
    button?.click();

    expect(router.navigate).toHaveBeenCalledWith([
      '/learning-paths', 'path-1', 'lessons', 'episode-2', 'exercises', 'exercise-2',
    ]);
  });

  it('returns to the course path when the rolling course is up to date', async () => {
    TestBed.resetTestingModule();
    const { fixture } = setup(null, 'up_to_date');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((item) => item.textContent?.trim() === 'Back to course');
    expect(button).toBeTruthy();
    button?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/library', 'course-1', 'learning-path']);
  });

  it('returns to the canonical course path when the backend supplied a numeric route id', async () => {
    TestBed.resetTestingModule();
    const { facade, fixture } = setup(null, 'up_to_date');
    facade.context.set({ ...completedContext, path: { ...completedContext.path, id: '1' } });
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.continueJourney();

    expect(router.navigate).toHaveBeenCalledWith(['/learning-paths', '1']);
  });

  it('cancels back through the legacy collection route for an old-backend source id', () => {
    TestBed.resetTestingModule();
    const { fixture } = setup(null, 'up_to_date');
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onExerciseOutcome({ kind: 'cancelled' });

    expect(router.navigate).toHaveBeenCalledWith(['/library', 'course-1', 'learning-path']);
  });
});
