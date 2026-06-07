import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { HrAccessService } from '@core/services/hr-access.service';
import { NavAccess } from '../../layout/nav-items';

/**
 * Route guard mirroring the sidebar's nav-access rules. If the current user doesn't meet the requirement,
 * they're redirected to the dashboard (so typing a restricted URL can't reach a hidden page).
 * - 'admin'      → admin / owner / super_admin role (resolved synchronously from the JWT)
 * - 'hrManage'   → HR-department members or admins (awaits GET /api/hr/access)
 * - 'teamLead'   → the above, or anyone with reports
 * - 'hasReports' → strictly someone with reports (a real manager) — excludes HR/admins without a team
 */
export const accessGuard =
  (requires: NavAccess): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const hrAccess = inject(HrAccessService);
    const router = inject(Router);
    const home = () => router.createUrlTree(['/dashboard']);

    const roles = (auth.user()?.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.some((r) => r === 'admin' || r === 'owner' || r === 'super_admin');

    if (requires === 'admin') return isAdmin ? true : home();
    if (requires === 'services') return isAdmin || roles.some((r) => r === 'services') ? true : home();
    if (requires === 'finance') return isAdmin || roles.some((r) => r === 'finance') ? true : home();

    return hrAccess.ensure().pipe(
      map((a) => {
        const ok =
          requires === 'hrManage'
            ? !!a?.canManage
            : requires === 'hasReports'
              ? !!a?.isTeamLead
              : !!(a?.canManage || a?.isTeamLead); // 'teamLead'
        return ok ? true : home();
      })
    );
  };
