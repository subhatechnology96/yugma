import { Routes } from '@angular/router';

export const MY_TEAM_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'employees' },
  {
    path: 'employees',
    loadComponent: () =>
      import('./team-employees.component').then((m) => m.TeamEmployeesComponent),
    data: { breadcrumb: 'Employees' }
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('./team-approvals.component').then((m) => m.TeamApprovalsComponent),
    data: { breadcrumb: 'Approvals' }
  },
  {
    path: 'performance',
    loadComponent: () =>
      import('../hr/performance/performance.component').then((m) => m.PerformanceComponent),
    data: { breadcrumb: 'Performance' }
  }
];
