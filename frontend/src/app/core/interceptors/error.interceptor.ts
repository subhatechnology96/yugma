import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messages = inject(MessageService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout();
      } else if (err.status === 403) {
        messages.add({ severity: 'warn', summary: 'Not allowed', detail: 'You do not have permission for this action.' });
      } else if (err.status >= 500) {
        messages.add({ severity: 'error', summary: 'Server error', detail: err.error?.detail ?? 'Please try again.' });
      } else if (err.status === 0) {
        messages.add({ severity: 'error', summary: 'Network', detail: 'API unreachable. Check your connection.' });
      }
      return throwError(() => err);
    })
  );
};
