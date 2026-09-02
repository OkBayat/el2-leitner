import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiError } from '../http/api-client.service';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    const user = await auth.currentUser();
    return user ? true : router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      return router.createUrlTree(['/offline'], { queryParams: { returnTo: state.url } });
    }
    throw error;
  }
};
