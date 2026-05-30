import { Routes } from '@angular/router';

export const CRM_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/crm-dashboard.component').then((m) => m.CrmDashboardComponent),
    data: { breadcrumb: 'Overview' }
  },
  {
    path: 'leads',
    loadComponent: () => import('./leads/leads-list.component').then((m) => m.LeadsListComponent),
    data: { breadcrumb: 'Leads' }
  },
  {
    path: 'deals',
    loadComponent: () => import('./pipeline/pipeline-board.component').then((m) => m.PipelineBoardComponent),
    data: { breadcrumb: 'Pipeline' }
  },
  {
    path: 'contacts',
    loadComponent: () => import('./contacts/contacts-list.component').then((m) => m.ContactsListComponent),
    data: { breadcrumb: 'Contacts' }
  },
  {
    path: 'accounts',
    loadComponent: () => import('./accounts/crm-accounts-list.component').then((m) => m.CrmAccountsListComponent),
    data: { breadcrumb: 'Accounts' }
  },
  {
    path: 'accounts/:id',
    loadComponent: () => import('./accounts/account-detail.component').then((m) => m.AccountDetailComponent),
    data: { breadcrumb: 'Account' }
  },
  {
    path: 'activities',
    loadComponent: () => import('./activities/activities.component').then((m) => m.CrmActivitiesComponent),
    data: { breadcrumb: 'Activities' }
  },
  {
    path: 'quotes',
    loadComponent: () => import('./quotes/quotes.component').then((m) => m.CrmQuotesComponent),
    data: { breadcrumb: 'Quotes' }
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/crm-analytics.component').then((m) => m.CrmAnalyticsComponent),
    data: { breadcrumb: 'CRM Analytics' }
  }
];
