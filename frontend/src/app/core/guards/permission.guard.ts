import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';

export const permissionGuard =
  (...required: string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const allowed = required.every((p) => auth.hasPermission(p));
    return allowed ? true : router.createUrlTree(['/dashboard']);
  };
