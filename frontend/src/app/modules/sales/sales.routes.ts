import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'crm' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/sales-dashboard.component').then((m) => m.SalesDashboardComponent),
    data: { breadcrumb: 'Dashboard' }
  },
  {
    path: 'crm',
    loadComponent: () => import('./crm/crm-pipeline.component').then((m) => m.CrmPipelineComponent),
    data: { breadcrumb: 'CRM Pipeline' }
  },
  {
    path: 'activities',
    loadComponent: () => import('./activities/sales-activities.component').then((m) => m.SalesActivitiesComponent),
    data: { breadcrumb: 'Activities' }
  },
  {
    path: 'quotations',
    loadComponent: () => import('./quotations/quotations.component').then((m) => m.QuotationsComponent),
    data: { breadcrumb: 'Quotations', mode: 'quotations', title: 'Quotations' }
  },
  {
    path: 'orders',
    loadComponent: () => import('./quotations/quotations.component').then((m) => m.QuotationsComponent),
    data: { breadcrumb: 'Sales Orders', mode: 'orders', title: 'Sales Orders' }
  },
  {
    path: 'products',
    loadComponent: () => import('./products/products.component').then((m) => m.ProductsComponent),
    data: { breadcrumb: 'Products' }
  }
];
