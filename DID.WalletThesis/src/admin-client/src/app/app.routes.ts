import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/auth/auth.guard';
import { scopeGuard } from './core/auth/scope.guard';

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
      { path: '', redirectTo: 'member-states', pathMatch: 'full' },
      {
        path: 'member-states',
        loadComponent: () =>
          import('./features/member-states/member-states.component').then(
            (m) => m.MemberStatesComponent,
          ),
        data: { minimumScope: 'EURoot' },
        canActivate: [scopeGuard],
      },
      {
        path: 'ministries',
        loadComponent: () =>
          import('./features/ministries/ministries.component').then(
            (m) => m.MinistriesComponent,
          ),
        data: { minimumScope: 'MemberState' },
        canActivate: [scopeGuard],
      },
      {
        path: 'universities',
        loadComponent: () =>
          import('./features/universities/universities.component').then(
            (m) => m.UniversitiesComponent,
          ),
        data: { minimumScope: 'Ministry' },
        canActivate: [scopeGuard],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
