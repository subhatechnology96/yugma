import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SalesService } from '../sales.service';
import { ACTIVITY_META, Opportunity } from '../models';

interface Row { oppId: string; oppName: string; customer: string; revenue: number; index: number; kind: string; summary: string; dueDate: string | null; by?: string | null; }

@Component({
  selector: 'app-sales-activities',
  standalone: true,
  imports: [DatePipe, RouterLink, ButtonModule, PageHeaderComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Sales · CRM" title="Activities" subtitle="Never miss out on a follow-up — every planned call, meeting, e-mail and quotation across your pipeline, sorted by when it's due."></app-page-header>

    <div class="grid grid-cols-3 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Overdue</div><div class="text-[26px] font-semibold tabular-nums" [class]="buckets().overdue.length ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100'">{{ buckets().overdue.length }}</div></div>
      <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Today</div><div class="text-[26px] font-semibold tabular-nums text-surface-800 dark:text-surface-100">{{ buckets().today.length }}</div></div>
      <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Upcoming</div><div class="text-[26px] font-semibold tabular-nums text-surface-800 dark:text-surface-100">{{ buckets().upcoming.length }}</div></div>
    </div>

    @for (group of groups(); track group.key) {
      @if (group.rows.length) {
        <div class="mb-5">
          <div class="section-title mb-2 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full" [class]="group.dot"></span>{{ group.label }} <span class="text-surface-400 font-normal">({{ group.rows.length }})</span></div>
          <div class="card p-0 overflow-hidden divide-y divide-surface-100 dark:divide-surface-800">
            @for (r of group.rows; track r.oppId + '-' + r.index) {
              <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-900/40 transition">
                <span class="w-8 h-8 rounded-full grid place-items-center shrink-0" [class]="group.key === 'overdue' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'">
                  <i class="pi {{ meta[r.kind]?.icon || 'pi-bell' }} text-sm"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{{ r.summary }}</div>
                  <div class="text-[11px] text-surface-400 truncate">{{ r.oppName }} · {{ r.customer }} · {{ r.revenue | inr: 'compact' }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-xs" [class]="group.key === 'overdue' ? 'text-rose-500 font-medium' : 'text-surface-500'">{{ r.dueDate ? (r.dueDate | date: 'EEE, dd MMM') : 'No date' }}</div>
                  <div class="text-[11px] text-surface-400">{{ meta[r.kind]?.label || r.kind }}</div>
                </div>
                <button pButton size="small" text icon="pi pi-check" pTooltip="Mark done" (click)="done(r)"></button>
                <a [routerLink]="['/sales/crm']" pButton size="small" text icon="pi pi-arrow-up-right" pTooltip="Open in pipeline"></a>
              </div>
            }
          </div>
        </div>
      }
    }
    @if (!rows().length) { <div class="card p-12 text-center text-surface-400 text-sm">🎉 You're all caught up — no pending activities.</div> }
  `
})
export class SalesActivitiesComponent {
  private readonly svc = inject(SalesService);
  private readonly messages = inject(MessageService);
  protected readonly meta = ACTIVITY_META;

  protected readonly rows = signal<Row[]>([]);

  constructor() { this.reload(); }
  private reload() {
    this.svc.opportunities().subscribe((opps: Opportunity[]) => {
      const rows: Row[] = [];
      for (const o of opps) {
        if (o.stage === 'Won' || o.stage === 'Lost') continue;
        for (const a of o.activities ?? []) {
          if (a.done || a.kind === 'stage') continue;
          rows.push({ oppId: o.id, oppName: o.name, customer: o.customer, revenue: o.expectedRevenue, index: a.index, kind: a.kind, summary: a.summary, dueDate: a.dueDate ?? null, by: a.by });
        }
      }
      rows.sort((a, b) => (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity));
      this.rows.set(rows);
    });
  }

  private startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  protected readonly buckets = computed(() => {
    const today = this.startOfToday();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const overdue: Row[] = [], todayRows: Row[] = [], upcoming: Row[] = [];
    for (const r of this.rows()) {
      if (!r.dueDate) { upcoming.push(r); continue; }
      const d = new Date(r.dueDate); d.setHours(0, 0, 0, 0);
      if (d < today) overdue.push(r);
      else if (d.getTime() === today.getTime()) todayRows.push(r);
      else upcoming.push(r);
    }
    return { overdue, today: todayRows, upcoming };
  });

  protected readonly groups = computed(() => {
    const b = this.buckets();
    return [
      { key: 'overdue', label: 'Overdue', dot: 'bg-rose-500', rows: b.overdue },
      { key: 'today', label: 'Today', dot: 'bg-amber-500', rows: b.today },
      { key: 'upcoming', label: 'Upcoming', dot: 'bg-emerald-500', rows: b.upcoming }
    ];
  });

  done(r: Row) {
    this.svc.completeActivity(r.oppId, r.index).subscribe(() => { this.reload(); this.messages.add({ severity: 'success', summary: 'Marked done' }); });
  }
}
