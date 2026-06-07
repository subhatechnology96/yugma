import { Routes } from '@angular/router';

export const SERVICES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/services-dashboard.component').then((m) => m.ServicesDashboardComponent),
    data: { breadcrumb: 'Overview' }
  },
  {
    path: 'pipeline',
    loadComponent: () => import('./pipeline/service-pipeline.component').then((m) => m.ServicePipelineComponent),
    data: { breadcrumb: 'Pipeline', type: null, title: 'Service pipeline' }
  },
  {
    path: 'project',
    loadComponent: () => import('./pipeline/service-pipeline.component').then((m) => m.ServicePipelineComponent),
    data: { breadcrumb: 'Project', type: 'Project', title: 'Projects' }
  },
  {
    path: 'field-service',
    loadComponent: () => import('./pipeline/service-pipeline.component').then((m) => m.ServicePipelineComponent),
    data: { breadcrumb: 'Field Service', type: 'FieldService', title: 'Field Service' }
  },
  {
    path: 'helpdesk',
    loadComponent: () => import('./pipeline/service-pipeline.component').then((m) => m.ServicePipelineComponent),
    data: { breadcrumb: 'Helpdesk', type: 'Helpdesk', title: 'Helpdesk' }
  },
  {
    path: 'appointments',
    loadComponent: () => import('./pipeline/service-pipeline.component').then((m) => m.ServicePipelineComponent),
    data: { breadcrumb: 'Appointments', type: 'Appointment', title: 'Appointments' }
  },
  {
    path: 'timesheets',
    loadComponent: () => import('./timesheets/timesheets.component').then((m) => m.TimesheetsComponent),
    data: { breadcrumb: 'Timesheets' }
  },
  {
    path: 'planning',
    loadComponent: () => import('./planning/planning.component').then((m) => m.PlanningComponent),
    data: { breadcrumb: 'Planning' }
  }
];
