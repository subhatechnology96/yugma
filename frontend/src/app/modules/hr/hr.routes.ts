import { Routes } from '@angular/router';
import { accessGuard } from '@core/guards/access.guard';

export const HR_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'employees' },
  {
    path: 'agents',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () =>
      import('./agents/agents-hub.component').then((m) => m.AgentsHubComponent),
    data: { breadcrumb: 'AI Agents' }
  },
  {
    path: 'employees',
    loadComponent: () =>
      import('./employees/employees-list.component').then((m) => m.EmployeesListComponent),
    data: { breadcrumb: 'Employees' }
  },
  {
    path: 'employees/new',
    loadComponent: () =>
      import('./employees/employee-form.component').then((m) => m.EmployeeFormComponent),
    data: { breadcrumb: 'New employee' }
  },
  {
    path: 'employees/:id',
    loadComponent: () =>
      import('./employees/employee-detail.component').then((m) => m.EmployeeDetailComponent),
    data: { breadcrumb: 'Employee' }
  },
  {
    path: 'attendance',
    loadComponent: () =>
      import('./attendance/attendance.component').then((m) => m.AttendanceComponent),
    data: { breadcrumb: 'Attendance' }
  },
  {
    path: 'leave',
    loadComponent: () => import('./leave/leave.component').then((m) => m.LeaveComponent),
    data: { breadcrumb: 'Leave' }
  },
  {
    path: 'payroll',
    loadComponent: () => import('./payroll/payroll.component').then((m) => m.PayrollComponent),
    data: { breadcrumb: 'Payroll' }
  },
  {
    path: 'payroll-runs',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () => import('./payroll/payroll-runs.component').then((m) => m.PayrollRunsComponent),
    data: { breadcrumb: 'Payroll' }
  },
  {
    path: 'recruitment',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () =>
      import('./recruitment/recruitment.component').then((m) => m.RecruitmentComponent),
    data: { breadcrumb: 'Recruitment' }
  },
  {
    path: 'time-off',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () => import('./timeoff/time-off.component').then((m) => m.TimeOffComponent),
    data: { breadcrumb: 'Time Off' }
  },
  {
    path: 'appraisals',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () => import('./appraisals/appraisals.component').then((m) => m.AppraisalsComponent),
    data: { breadcrumb: 'Appraisals' }
  },
  {
    path: 'referrals',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () => import('./referrals/referrals.component').then((m) => m.ReferralsComponent),
    data: { breadcrumb: 'Referrals' }
  },
  {
    path: 'fleet',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () => import('./fleet/fleet.component').then((m) => m.FleetComponent),
    data: { breadcrumb: 'Fleet' }
  },
  {
    path: 'performance',
    loadComponent: () =>
      import('./performance/my-performance.component').then((m) => m.MyPerformanceComponent),
    data: { breadcrumb: 'My Performance' }
  },
  {
    path: 'analytics',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () =>
      import('./analytics/hr-analytics.component').then((m) => m.HrAnalyticsComponent),
    data: { breadcrumb: 'HR Analytics' }
  },
  {
    path: 'hierarchy',
    // Open to everyone: the page defaults to the signed-in user's own lineage (read-only for
    // non-managers); manage actions are still gated by canManage in the component.
    loadComponent: () =>
      import('./hierarchy/hierarchy-management.component').then((m) => m.HierarchyManagementComponent),
    data: { breadcrumb: 'Hierarchy' } // L1–L10 bands, org tree, trail-to-CEO
  }
];
