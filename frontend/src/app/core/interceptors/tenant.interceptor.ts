import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '@core/services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenant = inject(TenantService);
  return next(
    req.clone({
      setHeaders: { 'X-Tenant-Id': tenant.currentId() }
    })
  );
};
