import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SalesService } from '../sales.service';
import { QUOTE_STATUS_META, SALES_STAGES, SalesSummary } from '../models';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink, ButtonModule, PageHeaderComponent, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Sales" title="Sales overview" subtitle="Pipeline health, quotations and confirmed orders — your whole revenue engine in one view.">
      <a routerLink="/sales/crm"><button pButton severity="secondary" outlined icon="pi pi-sitemap" label="Open pipeline"></button></a>
      <a routerLink="/sales/quotations"><button pButton icon="pi pi-file-edit" label="New quotation"></button></a>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[24px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- pipeline funnel -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="section-title">Pipeline by stage</div>
          <a routerLink="/sales/crm" class="text-xs text-brand-600 hover:underline">Open</a>
        </div>
        <div class="space-y-3">
          @for (f of funnel(); track f.label) {
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-medium text-surface-700 dark:text-surface-200 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full" [class]="f.dot"></span>{{ f.label }} <span class="text-surface-400">· {{ f.count }}</span></span>
                <span class="text-surface-500 tabular-nums">{{ f.value | inr: 'compact' }}</span>
              </div>
              <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden"><div class="h-full rounded-full" [class]="f.bar" [style.width.%]="f.pct"></div></div>
            </div>
          }
        </div>
      </div>

      <!-- recent quotations -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="section-title">Recent quotations</div>
          <a routerLink="/sales/quotations" class="text-xs text-brand-600 hover:underline">View all</a>
        </div>
        <div class="divide-y divide-surface-100 dark:divide-surface-800">
          @for (q of summary()?.recentQuotes ?? []; track q.id) {
            <a routerLink="/sales/quotations" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{{ q.number }} · {{ q.customer }}</div>
                <div class="text-[11px] text-surface-400">{{ q.orderDate | date: 'dd MMM yyyy' }}</div>
              </div>
              <app-status-pill [tone]="statusMeta[q.status].tone">{{ statusMeta[q.status].label }}</app-status-pill>
              <span class="text-sm font-semibold tabular-nums w-24 text-right">{{ q.total | inr: 'compact' }}</span>
            </a>
          }
          @if (!(summary()?.recentQuotes ?? []).length) { <div class="text-xs text-surface-400 py-4 text-center">No quotations yet.</div> }
        </div>
      </div>

      <!-- top opportunities -->
      <div class="card p-4 lg:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <div class="section-title">Top open opportunities</div>
          <a routerLink="/sales/crm" class="text-xs text-brand-600 hover:underline">Open pipeline</a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          @for (o of summary()?.topOpportunities ?? []; track o.id) {
            <a routerLink="/sales/crm" class="rounded-lg border border-surface-200/80 dark:border-surface-800 p-3 hover:border-surface-300 dark:hover:border-surface-700 transition">
              <div class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{{ o.name }}</div>
              <div class="text-[11px] text-surface-400 truncate">{{ o.customer }} · {{ o.salesperson || 'Unassigned' }}</div>
              <div class="flex items-center justify-between mt-2">
                <span class="text-sm font-semibold tabular-nums">{{ o.expectedRevenue | inr }}</span>
                <span class="text-[11px] text-surface-400">{{ o.probability }}% · {{ o.stage }}</span>
              </div>
            </a>
          }
          @if (!(summary()?.topOpportunities ?? []).length) { <div class="col-span-full text-xs text-surface-400 py-4 text-center">No open opportunities.</div> }
        </div>
      </div>
    </div>
  `
})
export class SalesDashboardComponent {
  private readonly svc = inject(SalesService);
  protected readonly statusMeta = QUOTE_STATUS_META;
  protected readonly summary = signal<SalesSummary | null>(null);

  constructor() { this.svc.summary().subscribe((s) => this.summary.set(s)); }

  protected readonly stats = computed(() => {
    const s = this.summary();
    const inr = new InrPipe();
    return [
      { label: 'Pipeline value', value: inr.transform(s?.pipelineValue ?? 0, 'compact'), caption: `${s?.openOpportunities ?? 0} open opportunities`, tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Won revenue', value: inr.transform(s?.wonRevenue ?? 0, 'compact'), caption: 'closed deals', tone: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Quotations', value: s?.quotationsOpen ?? 0, caption: inr.transform(s?.quotationsValue ?? 0, 'compact') + ' open', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Sales orders', value: s?.salesOrders ?? 0, caption: inr.transform(s?.salesOrdersValue ?? 0, 'compact') + ' confirmed', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  protected readonly funnel = computed(() => {
    const f = this.summary()?.stageFunnel ?? [];
    const max = Math.max(...f.map((x) => x.value), 1);
    return SALES_STAGES.map((s) => {
      const row = f.find((x) => x.stage === s.key);
      return { label: s.label, dot: s.dot, bar: s.bar, count: row?.count ?? 0, value: row?.value ?? 0, pct: Math.round(((row?.value ?? 0) / max) * 100) };
    });
  });
}
