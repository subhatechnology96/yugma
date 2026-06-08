import { Routes } from '@angular/router';

export const SUPPLY_CHAIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inventory' },
  { path: 'inventory', loadComponent: () => import('./inventory/inventory.component').then((m) => m.InventoryComponent), data: { breadcrumb: 'Inventory' } },
  { path: 'manufacturing', loadComponent: () => import('./manufacturing/manufacturing.component').then((m) => m.ManufacturingComponent), data: { breadcrumb: 'Manufacturing' } },
  { path: 'plm', loadComponent: () => import('./plm/plm.component').then((m) => m.PlmComponent), data: { breadcrumb: 'PLM' } },
  { path: 'purchase', loadComponent: () => import('./purchase/purchase.component').then((m) => m.PurchaseComponent), data: { breadcrumb: 'Purchase' } },
  { path: 'maintenance', loadComponent: () => import('./maintenance/maintenance.component').then((m) => m.MaintenanceComponent), data: { breadcrumb: 'Maintenance' } },
  { path: 'quality', loadComponent: () => import('./quality/quality.component').then((m) => m.QualityComponent), data: { breadcrumb: 'Quality' } }
];
