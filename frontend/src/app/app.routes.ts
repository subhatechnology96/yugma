import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { guestGuard } from '@core/guards/guest.guard';

export const APP_ROUTES: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { breadcrumb: 'Dashboard', icon: 'pi-home' }
      },
      {
        path: 'hr',
        loadChildren: () => import('./modules/hr/hr.routes').then((m) => m.HR_ROUTES),
        data: { breadcrumb: 'Human Resources', icon: 'pi-users' }
      },
      {
        path: 'crm',
        loadChildren: () => import('./modules/crm/crm.routes').then((m) => m.CRM_ROUTES),
        data: { breadcrumb: 'CRM', icon: 'pi-briefcase' }
      },
      {
        path: 'workflow',
        loadChildren: () =>
          import('./modules/workflow/workflow.routes').then((m) => m.WORKFLOW_ROUTES),
        data: { breadcrumb: 'Workflows', icon: 'pi-sitemap' }
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./modules/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
        data: { breadcrumb: 'Reports & Analytics', icon: 'pi-chart-bar' }
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./modules/notifications/notifications.component').then(
            (m) => m.NotificationsComponent
          ),
        data: { breadcrumb: 'Notifications', icon: 'pi-bell' }
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./modules/users/users.component').then((m) => m.UsersComponent),
        data: { breadcrumb: 'User Management', icon: 'pi-id-card' }
      },
      {
        path: 'it/provisioning',
        loadComponent: () =>
          import('./modules/it/provisioning/provisioning.component').then(
            (m) => m.ProvisioningComponent
          ),
        data: { breadcrumb: 'IT · New user provisioning', icon: 'pi-server' }
      },
      {
        path: 'configuration',
        loadComponent: () =>
          import('./modules/configuration/configuration.component').then(
            (m) => m.ConfigurationComponent
          ),
        data: { breadcrumb: 'Configuration', icon: 'pi-cog' }
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./modules/audit/audit.component').then((m) => m.AuditComponent),
        data: { breadcrumb: 'Audit Logs', icon: 'pi-shield' }
      },
      {
        path: 'ai-assistant',
        loadComponent: () =>
          import('./modules/ai-assistant/ai-assistant.component').then(
            (m) => m.AiAssistantComponent
          ),
        data: { breadcrumb: 'AI Assistant', icon: 'pi-sparkles' }
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./modules/settings/settings.component').then((m) => m.SettingsComponent),
        data: { breadcrumb: 'Settings', icon: 'pi-sliders-h' }
      }
    ]
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent)
  }
];
