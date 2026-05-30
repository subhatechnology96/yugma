import { Routes } from '@angular/router';

export const WORKFLOW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./workflow.component').then((m) => m.WorkflowComponent)
  }
];
