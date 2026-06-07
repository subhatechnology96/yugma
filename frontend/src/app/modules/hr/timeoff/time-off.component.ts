import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';

interface Leave { id: string; employee: string; type: string; from: string; to: string; days: number; status: string; reason?: string; appliedOn: string; approver?: string; }
interface Summary { pending: number; approvedMtd: number; rejectedMtd: number; onLeaveToday: number; balanceAvg?: number; }
interface Holiday { date: string; name: string; type: string; }

@Component({
  selector: 'app-hr-time-off',
  standalone: true,
  imports: [DatePipe, TableModule, ButtonModule, PageHeaderComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Human Resources" title="Time Off" subtitle="Leave requests, approvals and who's out — across your people." />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[24px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Pending approvals -->
      <div class="card lg:col-span-2 overflow-hidden">
        <div class="section-title p-3 pb-0">Pending approvals</div>
        <p-table [value]="pending()" responsiveLayout="scroll" [rowHover]="true" class="p-1">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!text-xs !uppercase !text-surface-500">Employee</th>
              <th class="!text-xs !uppercase !text-surface-500">Type</th>
              <th class="!text-xs !uppercase !text-surface-500">Dates</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-right">Days</th>
              <th class="!w-40"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-l>
            <tr>
              <td><div class="flex items-center gap-2"><app-avatar [name]="l.employee" size="xs" /><span class="text-sm font-medium">{{ l.employee }}</span></div></td>
              <td><span class="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 dark:bg-surface-800">{{ l.type }}</span></td>
              <td class="text-sm text-surface-500">{{ l.from | date: 'd MMM' }} – {{ l.to | date: 'd MMM' }}</td>
              <td class="text-right tabular-nums">{{ l.days }}</td>
              <td (click)="$event.stopPropagation()" class="text-right whitespace-nowrap">
                <button pButton size="small" text class="!text-[11px] !py-0 !text-rose-500" label="Reject" (click)="decide(l, 'reject')"></button>
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" label="Approve" (click)="decide(l, 'approve')"></button>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage"><tr><td colspan="5" class="py-8 text-center text-surface-400">Nothing pending — all caught up.</td></tr></ng-template>
        </p-table>
      </div>

      <div class="space-y-4">
        <!-- Out today -->
        <div class="card p-4">
          <div class="section-title mb-3">Out today <span class="text-surface-400 font-normal">· {{ outToday().length }}</span></div>
          <div class="space-y-2">
            @for (l of outToday(); track l.id) {
              <div class="flex items-center gap-2"><app-avatar [name]="l.employee" size="xs" /><div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">{{ l.employee }}</div><div class="text-[11px] text-surface-400">{{ l.type }} · back {{ l.to | date: 'd MMM' }}</div></div></div>
            }
            @if (!outToday().length) { <div class="text-xs text-surface-400">Everyone's in today.</div> }
          </div>
        </div>
        <!-- Upcoming holidays -->
        <div class="card p-4">
          <div class="section-title mb-3">Upcoming holidays</div>
          <div class="space-y-2">
            @for (h of upcomingHolidays(); track h.date) {
              <div class="flex items-center justify-between text-sm"><span class="text-surface-700 dark:text-surface-200">{{ h.name }}</span><span class="text-xs text-surface-400">{{ h.date | date: 'd MMM' }}</span></div>
            }
            @if (!upcomingHolidays().length) { <div class="text-xs text-surface-400">No upcoming holidays.</div> }
          </div>
        </div>
      </div>
    </div>
  `
})
export class TimeOffComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/my-work/leave`;

  protected readonly leaves = signal<Leave[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly holidays = signal<Holiday[]>([]);

  constructor() { this.reload(); }
  reload() {
    forkJoin({
      list: this.http.get<Leave[]>(this.base),
      summary: this.http.get<Summary>(`${this.base}/summary`),
      holidays: this.http.get<{ publicHolidays?: Holiday[]; optionalHolidays?: Holiday[] } | Holiday[]>(`${this.base}/holidays`)
    }).subscribe((r) => {
      this.leaves.set(r.list);
      this.summary.set(r.summary);
      const h = Array.isArray(r.holidays) ? r.holidays : [...(r.holidays.publicHolidays ?? []), ...(r.holidays.optionalHolidays ?? [])];
      this.holidays.set(h);
    });
  }

  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Pending', value: s?.pending ?? this.pending().length, caption: 'awaiting approval', tone: (s?.pending ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-surface-800 dark:text-surface-100' },
      { label: 'Out today', value: this.outToday().length, caption: 'on leave now', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Approved (MTD)', value: s?.approvedMtd ?? 0, caption: 'this month', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Avg balance', value: (s?.balanceAvg ?? 0) + 'd', caption: 'days available', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  protected readonly pending = computed(() => this.leaves().filter((l) => l.status === 'pending'));
  protected readonly outToday = computed(() => {
    const t = new Date(new Date().toDateString()).getTime();
    return this.leaves().filter((l) => l.status === 'approved' && new Date(l.from).getTime() <= t && new Date(l.to).getTime() >= t);
  });
  protected readonly upcomingHolidays = computed(() => {
    const t = new Date(new Date().toDateString()).getTime();
    return this.holidays().filter((h) => new Date(h.date).getTime() >= t).sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(0, 6);
  });

  decide(l: Leave, action: 'approve' | 'reject') {
    this.http.post(`${this.base}/${l.id}/${action}`, {}).subscribe({
      next: () => { this.messages.add({ severity: 'success', summary: action === 'approve' ? 'Approved' : 'Rejected', detail: l.employee }); this.reload(); },
      error: () => this.messages.add({ severity: 'error', summary: 'Action failed' })
    });
  }
}
