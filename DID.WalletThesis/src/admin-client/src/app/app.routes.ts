import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/auth/auth.guard';
import { scopeGuard, homeRedirectGuard } from './core/auth/scope.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', canActivate: [homeRedirectGuard], children: [] },
      {
        path: 'member-states',
        loadComponent: () =>
          import('./features/member-states/member-states.component').then(
            (m) => m.MemberStatesComponent,
          ),
        data: { allowedScopes: ['EURoot'] },
        canActivate: [scopeGuard],
      },
      {
        path: 'ministries',
        loadComponent: () =>
          import('./features/ministries/ministries.component').then(
            (m) => m.MinistriesComponent,
          ),
        data: { allowedScopes: ['MemberState'] },
        canActivate: [scopeGuard],
      },
      {
        path: 'universities',
        loadComponent: () =>
          import('./features/universities/universities.component').then(
            (m) => m.UniversitiesComponent,
          ),
        data: { allowedScopes: ['Ministry', 'Institution'] },
        canActivate: [scopeGuard],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
