import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CollectionLearningPathApiService } from './collection-learning-path-api.service';

export const legacyLearningPathExerciseRouteGuard: CanActivateFn = async (route) => {
  const api = inject(CollectionLearningPathApiService);
  const router = inject(Router);
  const canonical = await api.resolveLegacyExerciseRoute(
    route.paramMap.get('pathId') ?? '',
    route.paramMap.get('lessonId') ?? '',
    route.paramMap.get('exerciseId') ?? '',
  );
  return router.createUrlTree([
    '/learning-paths', canonical.pathId,
    'lessons', canonical.lessonId,
    'exercises', canonical.exerciseId,
  ]);
};
