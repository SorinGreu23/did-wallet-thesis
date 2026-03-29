import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const scopeGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const minimumScope = route.data?.['minimumScope'] as string;

  if (!minimumScope || auth.hasScope(minimumScope)) return true;

  router.navigate(['/']);
  return false;
};
