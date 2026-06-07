import { Routes } from '@angular/router';

export const FINANCE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'accounting' },
  {
    path: 'accounting',
    loadComponent: () => import('./accounting/accounting-dashboard.component').then((m) => m.AccountingDashboardComponent),
    data: { breadcrumb: 'Accounting' }
  },
  {
    path: 'invoicing',
    loadComponent: () => import('./invoicing/invoicing.component').then((m) => m.InvoicingComponent),
    data: { breadcrumb: 'Invoicing' }
  },
  {
    path: 'expenses',
    loadComponent: () => import('./expenses/expenses.component').then((m) => m.ExpensesComponent),
    data: { breadcrumb: 'Expenses' }
  },
  {
    path: 'spreadsheet',
    loadComponent: () => import('./spreadsheet/spreadsheet.component').then((m) => m.SpreadsheetComponent),
    data: { breadcrumb: 'Spreadsheet (BI)' }
  },
  {
    path: 'documents',
    loadComponent: () => import('./documents/documents.component').then((m) => m.DocumentsComponent),
    data: { breadcrumb: 'Documents' }
  },
  {
    path: 'sign',
    loadComponent: () => import('./documents/documents.component').then((m) => m.DocumentsComponent),
    data: { breadcrumb: 'Sign', sign: true }
  }
];
