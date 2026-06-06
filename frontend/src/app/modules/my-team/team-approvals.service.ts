import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import { HrAccessService } from '@core/services/hr-access.service';
import { CorrectionRow, LeaveRow } from '../my-requests/my-requests.models';

/** A normalized pending request awaiting the current manager's decision. */
export interface TeamApproval {
  id: string;
  category: 'leave' | 'attendance';
  employeeId: string | null;
  employee: string;
  /** Human label for the kind, e.g. "Casual Leave" / "Time correction". */
  typeLabel: string;
  icon: string;
  /** Headline, e.g. "Casual Leave · 2 days". */
  title: string;
  /** Date / range line, e.g. "2026-06-11 → 2026-06-12". */
  subtitle: string;
  /** The requester's note / reason. */
  summary: string;
  /** ISO timestamp the request was submitted. */
  submittedOn: string;
}

/**
 * Loads the requests a manager can act on — pending leave applications and attendance corrections from
 * their team (reports only) — and exposes approve/reject actions. Reuses the existing scoped endpoints:
 * leave self-scopes to self+team (we drop the manager's own rows here), and corrections take `scope=team`.
 */
@Injectable({ providedIn: 'root' })
export class TeamApprovalsService {
  private readonly http = inject(HttpClient);
  private readonly hrAccess = inject(HrAccessService);
  private readonly base = environment.apiBaseUrl;

  private readonly _items = signal<TeamApproval[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly leaveCount = computed(() => this._items().filter((i) => i.category === 'leave').length);
  readonly attendanceCount = computed(() => this._items().filter((i) => i.category === 'attendance').length);
  readonly total = computed(() => this._items().length);

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.hrAccess
      .ensure()
      .pipe(
        switchMap((acc) => {
          const myName = acc?.name ?? null;
          const leave$ = this.http
            .get<LeaveRow[]>(`${this.base}/my-work/leave`, { params: { status: 'pending' } })
            .pipe(catchError(() => of([] as LeaveRow[])));
          const corrections$ = this.http
            .get<CorrectionRow[]>(`${this.base}/my-work/attendance/corrections`, {
              params: { scope: 'team', status: 'pending' }
            })
            .pipe(catchError(() => of([] as CorrectionRow[])));
          return forkJoin({ leave: leave$, corrections: corrections$, myName: of(myName) });
        })
      )
      .subscribe({
        next: ({ leave, corrections, myName }) => {
          // Leave self-scopes to self+team — exclude the manager's own rows so this is strictly the team's.
          const teamLeave = myName ? leave.filter((r) => r.employee !== myName) : leave;
          const items = [
            ...teamLeave.map((r) => this.fromLeave(r)),
            ...corrections.map((c) => this.fromCorrection(c))
          ].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1));
          this._items.set(items);
          this._loading.set(false);
        },
        error: () => {
          this._error.set('Could not load approvals. Please try again.');
          this._loading.set(false);
        }
      });
  }

  approve(item: TeamApproval) {
    const url =
      item.category === 'leave'
        ? `${this.base}/my-work/leave/${item.id}/approve`
        : `${this.base}/my-work/attendance/corrections/${item.id}/approve`;
    return this.http.post(url, {});
  }

  reject(item: TeamApproval, note?: string) {
    if (item.category === 'leave') {
      return this.http.post(`${this.base}/my-work/leave/${item.id}/reject`, {});
    }
    return this.http.post(`${this.base}/my-work/attendance/corrections/${item.id}/reject`, { note: note ?? null });
  }

  /** Remove an item locally after a successful decision (keeps the inbox snappy without a full reload). */
  remove(id: string): void {
    this._items.update((list) => list.filter((i) => i.id !== id));
  }

  private fromLeave(r: LeaveRow): TeamApproval {
    const typeLabel = this.leaveTypeLabel(r.type);
    return {
      id: r.id,
      category: 'leave',
      employeeId: r.employeeId,
      employee: r.employee,
      typeLabel,
      icon: 'pi-calendar',
      title: `${typeLabel} · ${r.days} day${r.days === 1 ? '' : 's'}`,
      subtitle: r.from === r.to ? r.from : `${r.from} → ${r.to}`,
      summary: r.reason,
      submittedOn: r.appliedOn
    };
  }

  private fromCorrection(c: CorrectionRow): TeamApproval {
    const times = c.requestedInTime ? ` · ${c.requestedInTime}–${c.requestedOutTime}` : '';
    return {
      id: c.id,
      category: 'attendance',
      employeeId: c.employeeId,
      employee: c.employeeName,
      typeLabel: 'Time correction',
      icon: 'pi-clock',
      title: `Time correction · ${this.attStatusLabel(c.requestedStatus)}`,
      subtitle: `${c.date}${times}`,
      summary: c.reason,
      submittedOn: c.requestedAt
    };
  }

  private attStatusLabel(s: string): string {
    return { present: 'Present', wfh: 'Work from home', late: 'Late', leave: 'On leave', absent: 'Absent' }[s] ?? s;
  }

  private leaveTypeLabel(type: string): string {
    const map: Record<string, string> = {
      Casual: 'Casual Leave',
      Sick: 'Sick Leave',
      Earned: 'Earned Leave',
      Paid: 'Paid Leave',
      CompOff: 'Comp-off',
      Unpaid: 'Unpaid Leave',
      Special: 'Special Leave',
      Blocked: 'Blocked Leave',
      RestrictedHoliday: 'Restricted Holiday'
    };
    return map[type] ?? `${type} Leave`;
  }
}
