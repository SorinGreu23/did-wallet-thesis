import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const scopeGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedScopes = route.data?.['allowedScopes'] as string[] | undefined;

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  const currentScope = auth.scope();
  if (!allowedScopes || (currentScope !== null && allowedScopes.includes(currentScope))) return true;

  return router.parseUrl(auth.getHomeRoute());
};

export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  return router.parseUrl(auth.getHomeRoute());
};
