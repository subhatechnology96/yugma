import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'forgot',
    loadComponent: () => import('./forgot/forgot.component').then((m) => m.ForgotComponent)
  },
  {
    path: 'otp',
    loadComponent: () => import('./otp/otp.component').then((m) => m.OtpComponent)
  },
  {
    path: 'mfa',
    loadComponent: () => import('./mfa/mfa.component').then((m) => m.MfaComponent)
  }
];
