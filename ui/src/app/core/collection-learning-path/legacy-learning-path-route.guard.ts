import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CollectionLearningPathApiService } from './collection-learning-path-api.service';

export const legacyLearningPathExerciseRouteGuard: CanActivateFn = async (route) => {
  const api = inject(CollectionLearningPathApiService);
  const router = inject(Router);
  const legacy = {
    pathId: route.paramMap.get('pathId') ?? '',
    lessonId: route.paramMap.get('lessonId') ?? '',
    exerciseId: route.paramMap.get('exerciseId') ?? '',
  };
  const canonical = await api.resolveLegacyExerciseRoute(
    legacy.pathId,
    legacy.lessonId,
    legacy.exerciseId,
  ).catch(() => legacy);
  return router.createUrlTree([
    '/learning-paths', canonical.pathId,
    'lessons', canonical.lessonId,
    'exercises', canonical.exerciseId,
  ]);
};
