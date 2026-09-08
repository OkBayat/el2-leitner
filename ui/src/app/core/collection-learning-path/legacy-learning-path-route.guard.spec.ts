import { TestBed } from '@angular/core/testing';
import { Router, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from './collection-learning-path-api.service';
import { legacyLearningPathExerciseRouteGuard } from './legacy-learning-path-route.guard';

describe('legacyLearningPathExerciseRouteGuard', () => {
  it('resolves source ids once and redirects to the canonical numeric hierarchy', async () => {
    const resolveLegacyExerciseRoute = vi.fn().mockResolvedValue({
      pathId: '1',
      lessonId: '5',
      exerciseId: '10',
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CollectionLearningPathApiService, useValue: { resolveLegacyExerciseRoute } },
      ],
    });
    const route = {
      paramMap: convertToParamMap({
        pathId: 'source-path',
        lessonId: 'source-lesson',
        exerciseId: 'source-exercise',
      }),
    };

    const result = await TestBed.runInInjectionContext(() =>
      legacyLearningPathExerciseRouteGuard(route as never, {} as never) as Promise<unknown>);

    expect(resolveLegacyExerciseRoute).toHaveBeenCalledWith(
      'source-path',
      'source-lesson',
      'source-exercise',
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      '/learning-paths/1/lessons/5/exercises/10',
    );
  });

  it('uses the existing source-id API route while an older backend has no resolver endpoint', async () => {
    const resolveLegacyExerciseRoute = vi.fn().mockRejectedValue(new Error('Not found'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CollectionLearningPathApiService, useValue: { resolveLegacyExerciseRoute } },
      ],
    });
    const route = {
      paramMap: convertToParamMap({
        pathId: 'source-path',
        lessonId: 'source-lesson',
        exerciseId: 'source-exercise',
      }),
    };

    const result = await TestBed.runInInjectionContext(() =>
      legacyLearningPathExerciseRouteGuard(route as never, {} as never) as Promise<unknown>);

    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      '/learning-paths/source-path/lessons/source-lesson/exercises/source-exercise',
    );
  });
});
