import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface HrAccess {
  employeeId: string | null;
  name: string | null;
  department: string | null;
  isHr: boolean;
  canManage: boolean;
  isTeamLead: boolean;
  scope: 'all' | 'team' | 'self';
}

/**
 * Single source of truth for HR-module access. Resolved once from the backend (`GET /api/hr/access`),
 * which decides manage vs. own-data-only from the user's DEPARTMENT (Human Resources) or admin/owner role —
 * so HR staff get manage controls even without an admin role. HR screens gate their manage UI on
 * `canManage()` instead of checking roles directly.
 */
@Injectable({ providedIn: 'root' })
export class HrAccessService {
  private readonly http = inject(HttpClient);
  private readonly _access = signal<HrAccess | null>(null);

  readonly access = this._access.asReadonly();
  readonly canManage = computed(() => this._access()?.canManage ?? false);
  readonly isHr = computed(() => this._access()?.isHr ?? false);
  readonly isTeamLead = computed(() => this._access()?.isTeamLead ?? false);
  readonly scope = computed(() => this._access()?.scope ?? 'self');
  readonly restricted = computed(() => (this._access() ? !this._access()!.canManage : false));
  /** Can act on team-level data (HR/admin everywhere, or a team lead on their reports). */
  readonly canManageTeam = computed(() => this.canManage() || this.isTeamLead());

  private access$?: Observable<HrAccess | null>;

  constructor() {
    this.ensure().subscribe();
  }

  /** Loads the access context once and caches it; route guards subscribe to await it. */
  ensure(): Observable<HrAccess | null> {
    if (!this.access$) {
      this.access$ = this.http.get<HrAccess>(`${environment.apiBaseUrl}/hr/access`).pipe(
        tap((a) => this._access.set(a)),
        catchError(() => of(null)),
        shareReplay(1)
      );
    }
    return this.access$;
  }

  refresh(): void {
    this.access$ = undefined;
    this.ensure().subscribe();
  }
}
