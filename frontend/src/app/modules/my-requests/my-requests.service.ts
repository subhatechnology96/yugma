import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import { HrAccessService } from '@core/services/hr-access.service';
import { ApprovalStep, ApprovalStepStatus } from '@shared/components/approval-flow/approval-flow.component';
import { CorrectionRow, LeaveRow, MyRequest, RequestStatus, TrailNode } from './my-requests.models';

/** The decision facts an approval timeline is rendered from, shared by every request type. */
interface ApprovalFacts {
  requesterName: string;
  submittedAt: string;
  status: RequestStatus;
  approver: string | null;
  decidedAt: string | null;
}

/**
 * Loads the signed-in user's own requests and resolves each one's approval flow.
 *
 * Approvals in the platform are single-level — a leave request is decided by the
 * requester's reporting manager. We render the *full* reporting trail-to-CEO so the
 * user can see the escalation line, overlaying the real decision on the direct-manager
 * step and marking higher levels as upcoming (while pending) or not required (once decided).
 */
@Injectable({ providedIn: 'root' })
export class MyRequestsService {
  private readonly http = inject(HttpClient);
  private readonly hrAccess = inject(HrAccessService);
  private readonly base = environment.apiBaseUrl;

  private readonly _requests = signal<MyRequest[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly requests = this._requests.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.hrAccess
      .ensure()
      .pipe(
        switchMap((acc) => {
          const myName = acc?.name ?? null;
          const empId = acc?.employeeId ?? null;
          const leave$ = this.http
            .get<LeaveRow[]>(`${this.base}/my-work/leave`)
            .pipe(catchError(() => of([] as LeaveRow[])));
          const corrections$ = this.http
            .get<CorrectionRow[]>(`${this.base}/my-work/attendance/corrections`)
            .pipe(catchError(() => of([] as CorrectionRow[])));
          const trail$ = empId
            ? this.http
                .get<TrailNode[]>(`${this.base}/my-work/hierarchy/employee/${empId}/trail`)
                .pipe(catchError(() => of([] as TrailNode[])))
            : of([] as TrailNode[]);
          return forkJoin({ leave: leave$, corrections: corrections$, trail: trail$, myName: of(myName) });
        })
      )
      .subscribe({
        next: ({ leave, corrections, trail, myName }) => {
          // The leave endpoint already self-scopes for associates; restrict strictly to
          // "mine" so the screen stays personal even for managers (who also see their team).
          const mine = myName ? leave.filter((r) => r.employee === myName) : leave;
          const requests = [
            ...mine.map((r) => this.fromLeave(r, trail)),
            ...corrections.map((c) => this.fromCorrection(c, trail))
          ].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1));
          this._requests.set(requests);
          this._loading.set(false);
        },
        error: () => {
          this._error.set('Could not load your requests. Please try again.');
          this._loading.set(false);
        }
      });
  }

  private fromLeave(r: LeaveRow, trail: TrailNode[]): MyRequest {
    const typeLabel = this.leaveTypeLabel(r.type);
    const facts: ApprovalFacts = { requesterName: r.employee, submittedAt: r.appliedOn, status: r.status, approver: r.approver, decidedAt: r.decidedAt };
    return {
      id: r.id,
      category: 'leave',
      typeLabel,
      icon: 'pi-calendar',
      title: `${typeLabel} · ${r.days} day${r.days === 1 ? '' : 's'}`,
      subtitle: `${r.from} → ${r.to}`,
      status: r.status,
      submittedOn: r.appliedOn,
      summary: r.reason,
      steps: this.buildSteps(facts, trail),
      pendingWith: r.status === 'pending' ? r.approver ?? trail[1]?.name ?? null : null
    };
  }

  private fromCorrection(c: CorrectionRow, trail: TrailNode[]): MyRequest {
    const facts: ApprovalFacts = { requesterName: c.employeeName, submittedAt: c.requestedAt, status: c.status, approver: c.approver, decidedAt: c.decidedAt };
    const times = c.requestedInTime ? ` · ${c.requestedInTime}–${c.requestedOutTime}` : '';
    return {
      id: c.id,
      category: 'attendance',
      typeLabel: 'Time correction',
      icon: 'pi-clock',
      title: `Time correction · ${this.attStatusLabel(c.requestedStatus)}`,
      subtitle: `${c.date}${times}`,
      status: c.status,
      submittedOn: c.requestedAt,
      summary: c.reason,
      steps: this.buildSteps(facts, trail),
      pendingWith: c.status === 'pending' ? c.approver ?? trail[1]?.name ?? null : null
    };
  }

  /**
   * Builds the approval timeline: the requester (submitted) → reporting manager
   * (the actual decision) → the remaining trail-to-CEO (escalation line, informational).
   */
  private buildSteps(f: ApprovalFacts, trail: TrailNode[]): ApprovalStep[] {
    const me = trail[0];
    const steps: ApprovalStep[] = [
      {
        label: 'Submitted',
        actor: me?.name ?? f.requesterName,
        levelCode: me?.levelCode ?? null,
        designation: me?.designation ?? null,
        avatarUrl: me?.avatarUrl ?? null,
        status: 'submitted',
        at: f.submittedAt,
        note: null
      }
    ];

    // Managers up the chain (direct manager first). Fall back to the snapshot approver
    // name when the org tree has no manager recorded.
    let managers = trail.slice(1);
    if (managers.length === 0 && f.approver) {
      managers = [{ name: f.approver } as TrailNode];
    }

    managers.forEach((m, i) => {
      const isDirect = i === 0;
      let status: ApprovalStepStatus;
      let at: string | null = null;
      let note: string | null = null;

      if (isDirect) {
        switch (f.status) {
          case 'approved':
            status = 'approved';
            at = f.decidedAt;
            break;
          case 'rejected':
            status = 'rejected';
            at = f.decidedAt;
            break;
          case 'cancelled':
            status = 'skipped';
            note = 'Request cancelled';
            break;
          default:
            status = 'current';
            note = 'Awaiting decision';
        }
      } else if (f.status === 'pending') {
        status = 'pending';
        note = 'Not yet reached';
      } else {
        status = 'skipped';
        note = 'Not required';
      }

      steps.push({
        label: isDirect ? 'Manager approval' : `${m.levelTitle ?? 'Leadership'} review`,
        actor: (isDirect ? f.approver : null) ?? m.name,
        levelCode: m.levelCode ?? null,
        designation: m.designation ?? null,
        avatarUrl: m.avatarUrl ?? null,
        status,
        at,
        note
      });
    });

    return steps;
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
