import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'member-states', pathMatch: 'full' },
      {
        path: 'member-states',
        loadComponent: () =>
          import('./features/member-states/member-states.component').then(
            (m) => m.MemberStatesComponent,
          ),
      },
      {
        path: 'ministries',
        loadComponent: () =>
          import('./features/ministries/ministries.component').then(
            (m) => m.MinistriesComponent,
          ),
      },
      {
        path: 'universities',
        loadComponent: () =>
          import('./features/universities/universities.component').then(
            (m) => m.UniversitiesComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'member-states' },
];
