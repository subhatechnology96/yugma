import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { FinanceService } from '../finance.service';
import { FinanceAnalytics } from '../models';

@Component({
  selector: 'app-finance-spreadsheet',
  standalone: true,
  imports: [PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Finance" title="Spreadsheet (BI)" subtitle="Business intelligence on income, spend and profitability." />

    <div class="grid grid-cols-2 lg:grid-cols-3 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      @for (k of kpis(); track k.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ k.label }}</div>
          <div class="text-[24px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="k.tone">{{ money(k.value) }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ k.caption }}</div>
        </div>
      }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Income vs Spend -->
      <div class="card p-4 lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <div class="section-title">Income vs spend — last 6 months</div>
          <div class="flex items-center gap-3 text-[11px]">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-brand-500"></span>Income</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-rose-400"></span>Spend</span>
          </div>
        </div>
        <div class="flex items-end justify-between gap-4 h-48">
          @for (m of revenue(); track m.month) {
            <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <div class="w-full flex items-end justify-center gap-1 h-full">
                <div class="w-1/2 max-w-[26px] rounded-t bg-brand-500" [style.height.%]="m.incomePct" [title]="money(m.income)"></div>
                <div class="w-1/2 max-w-[26px] rounded-t bg-rose-400" [style.height.%]="m.spendPct" [title]="money(m.spend)"></div>
              </div>
              <div class="text-[11px] text-surface-400">{{ m.month }}</div>
            </div>
          }
        </div>
      </div>

      <!-- Expenses by category -->
      <div class="card p-4">
        <div class="section-title mb-3">Expenses by category</div>
        <div class="space-y-2.5">
          @for (c of analytics()?.expenseByCategory ?? []; track c.category) {
            <div>
              <div class="flex items-center justify-between text-xs mb-1"><span class="font-medium text-surface-700 dark:text-surface-200">{{ c.category }}</span><span class="text-surface-500 tabular-nums">{{ money(c.amount) }}</span></div>
              <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden"><div class="h-full rounded-full bg-brand-500" [style.width.%]="catPct(c.amount)"></div></div>
            </div>
          }
          @if (!(analytics()?.expenseByCategory ?? []).length) { <div class="text-xs text-surface-400">No expenses.</div> }
        </div>
      </div>

      <!-- Top customers -->
      <div class="card p-4">
        <div class="section-title mb-3">Top customers by billing</div>
        <div class="divide-y divide-surface-100 dark:divide-surface-800">
          @for (c of analytics()?.topCustomers ?? []; track c.partner) {
            <div class="py-2">
              <div class="flex items-center justify-between text-sm mb-1">
                <span class="font-medium text-surface-700 dark:text-surface-200">{{ c.partner }}</span>
                <span class="tabular-nums">{{ money(c.total) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <div class="h-full rounded-full bg-emerald-500" [style.width.%]="custPct(c.paid)" [title]="'Paid ' + money(c.paid)"></div>
              </div>
              <div class="text-[10px] text-surface-400 mt-0.5">{{ money(c.paid) }} collected</div>
            </div>
          }
          @if (!(analytics()?.topCustomers ?? []).length) { <div class="text-xs text-surface-400 py-3">No data.</div> }
        </div>
      </div>
    </div>
  `
})
export class SpreadsheetComponent {
  private readonly svc = inject(FinanceService);
  protected readonly analytics = signal<FinanceAnalytics | null>(null);

  constructor() { this.svc.analytics().subscribe((a) => this.analytics.set(a)); }

  protected readonly kpis = computed(() => {
    const k = this.analytics()?.kpis;
    return [
      { label: 'Income', value: k?.income ?? 0, caption: 'invoiced', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Spend', value: k?.spend ?? 0, caption: 'bills + expenses', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Net profit', value: k?.profit ?? 0, caption: 'income − spend', tone: (k?.profit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
      { label: 'Receivable', value: k?.receivable ?? 0, caption: 'owed to us', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Payable', value: k?.payable ?? 0, caption: 'we owe', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Expenses', value: k?.expenses ?? 0, caption: 'employee claims', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  protected readonly revenue = computed(() => {
    const r = this.analytics()?.revenue ?? [];
    const max = Math.max(...r.flatMap((m) => [m.income, m.spend]), 1);
    return r.map((m) => ({ month: m.month, income: m.income, spend: m.spend, incomePct: Math.round((m.income / max) * 100), spendPct: Math.round((m.spend / max) * 100) }));
  });

  catPct(amount: number): number {
    const max = Math.max(...(this.analytics()?.expenseByCategory ?? []).map((c) => c.amount), 1);
    return Math.round((amount / max) * 100);
  }
  custPct(paid: number): number {
    const max = Math.max(...(this.analytics()?.topCustomers ?? []).map((c) => c.total), 1);
    return Math.round((paid / max) * 100);
  }
  money(n: number): string { return '₹' + Math.round(n).toLocaleString('en-IN'); }
}
