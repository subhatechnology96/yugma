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
    path: 'recruitment',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () =>
      import('./recruitment/recruitment.component').then((m) => m.RecruitmentComponent),
    data: { breadcrumb: 'Recruitment' }
  },
  {
    path: 'performance',
    loadComponent: () =>
      import('./performance/performance.component').then((m) => m.PerformanceComponent),
    data: { breadcrumb: 'Performance' }
  },
  {
    path: 'analytics',
    canActivate: [accessGuard('hrManage')],
    loadComponent: () =>
      import('./analytics/hr-analytics.component').then((m) => m.HrAnalyticsComponent),
    data: { breadcrumb: 'HR Analytics' }
  },
  {
    path: 'team',
    canActivate: [accessGuard('teamLead')],
    loadComponent: () =>
      import('./team/team-management.component').then((m) => m.TeamManagementComponent),
    data: { breadcrumb: 'Team Management' } // centralized hierarchy assignment
  },
  {
    path: 'hierarchy',
    canActivate: [accessGuard('teamLead')],
    loadComponent: () =>
      import('./hierarchy/hierarchy-management.component').then((m) => m.HierarchyManagementComponent),
    data: { breadcrumb: 'Hierarchy Management' } // L1–L10 bands, org tree, trail-to-CEO
  }
];
