import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const scopeGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const minimumScope = route.data?.['minimumScope'] as string;

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  if (!minimumScope || auth.hasScope(minimumScope)) return true;

  return router.parseUrl(auth.getHomeRoute());
};
