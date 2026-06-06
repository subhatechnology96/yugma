import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { TeamApproval, TeamApprovalsService } from './team-approvals.service';

type Filter = 'all' | 'leave' | 'attendance';

/**
 * "My Team · Approvals" — a manager's inbox of pending requests from their reports (leave + attendance
 * corrections) with one-click approve / reject. Decisions hit the existing scoped endpoints, which
 * re-check that the caller manages the requester.
 */
@Component({
  selector: 'app-team-approvals',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    TooltipModule,
    PageHeaderComponent,
    AvatarComponent,
    KpiCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-approvals.component.html'
})
export class TeamApprovalsComponent implements OnInit {
  protected readonly svc = inject(TeamApprovalsService);
  private readonly messages = inject(MessageService);

  protected readonly filter = signal<Filter>('all');
  /** Ids currently mid-decision, so we can disable their buttons / show a spinner. */
  protected readonly busy = signal<Set<string>>(new Set());

  // Reject dialog state.
  protected readonly rejectTarget = signal<TeamApproval | null>(null);
  protected rejectNote = '';

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const items = this.svc.items();
    return f === 'all' ? items : items.filter((i) => i.category === f);
  });

  ngOnInit() {
    this.svc.load();
  }

  setFilter(f: Filter) {
    this.filter.set(f);
  }

  isBusy(id: string) {
    return this.busy().has(id);
  }

  approve(item: TeamApproval) {
    this.setBusy(item.id, true);
    this.svc.approve(item).subscribe({
      next: () => {
        this.svc.remove(item.id);
        this.setBusy(item.id, false);
        this.messages.add({
          severity: 'success',
          summary: 'Approved',
          detail: `${item.typeLabel} for ${item.employee} approved.`
        });
      },
      error: (e) => {
        this.setBusy(item.id, false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not approve',
          detail: e?.error?.message ?? 'Please try again.'
        });
      }
    });
  }

  openReject(item: TeamApproval) {
    this.rejectNote = '';
    this.rejectTarget.set(item);
  }

  cancelReject() {
    this.rejectTarget.set(null);
    this.rejectNote = '';
  }

  confirmReject() {
    const item = this.rejectTarget();
    if (!item) return;
    this.setBusy(item.id, true);
    const note = this.rejectNote.trim();
    this.svc.reject(item, note || undefined).subscribe({
      next: () => {
        this.svc.remove(item.id);
        this.setBusy(item.id, false);
        this.cancelReject();
        this.messages.add({
          severity: 'info',
          summary: 'Rejected',
          detail: `${item.typeLabel} for ${item.employee} was rejected.`
        });
      },
      error: (e) => {
        this.setBusy(item.id, false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not reject',
          detail: e?.error?.message ?? 'Please try again.'
        });
      }
    });
  }

  /** Tailwind accent classes per category, for the card's left rail and icon chip. */
  accent(category: TeamApproval['category']) {
    return category === 'leave'
      ? { rail: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' }
      : { rail: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' };
  }

  private setBusy(id: string, on: boolean) {
    const next = new Set(this.busy());
    on ? next.add(id) : next.delete(id);
    this.busy.set(next);
  }
}
