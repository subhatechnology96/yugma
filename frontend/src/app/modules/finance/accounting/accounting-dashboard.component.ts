import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { FinanceService } from '../finance.service';
import { AccountCard, DocCard, FinanceDashboard } from '../models';

@Component({
  selector: 'app-accounting-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, ButtonModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Finance" title="Accounting" subtitle="Receivables, payables and your bank position at a glance." />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Customer Invoices -->
      <div class="card p-5 border-l-2 border-l-brand-400">
        <div class="flex items-start justify-between mb-3">
          <div class="text-[15px] font-semibold text-brand-700 dark:text-brand-300">Customer Invoices</div>
          <a routerLink="/finance/invoicing"><button pButton size="small" label="New" icon="pi pi-plus"></button></a>
        </div>
        @if (dash(); as d) {
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5 self-center">
              <div class="flex items-center justify-between text-sm"><span class="text-brand-600">{{ d.customerInvoices.toValidate.count }} To Validate</span><span class="font-medium tabular-nums">{{ money(d.customerInvoices.toValidate.amount) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-brand-600">{{ d.customerInvoices.unpaid.count }} Unpaid</span><span class="font-medium tabular-nums">{{ money(d.customerInvoices.unpaid.amount) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-rose-500">{{ d.customerInvoices.late.count }} Late</span><span class="font-medium tabular-nums text-rose-500">{{ money(d.customerInvoices.late.amount) }}</span></div>
            </div>
            <div>
              <div class="flex items-end justify-between gap-1 h-[96px] pt-2">
                @for (b of aging(d.customerInvoices); track b.label) {
                  <div class="flex-1 flex flex-col items-center justify-end h-full">
                    <div class="w-full rounded-t" [class]="b.amount > 0 ? 'bg-brand-300' : 'bg-surface-100 dark:bg-surface-800'" [style.height.%]="b.h" [title]="b.label + ': ' + money(b.amount)"></div>
                  </div>
                }
              </div>
              <div class="flex justify-between gap-1 mt-1">
                @for (b of aging(d.customerInvoices); track b.label) {
                  <div class="flex-1 text-center text-[9px] leading-tight text-surface-400 truncate">{{ b.label }}</div>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Vendor Bills -->
      <div class="card p-5 border-l-2 border-l-indigo-400">
        <div class="flex items-start justify-between mb-3">
          <div class="text-[15px] font-semibold text-indigo-700 dark:text-indigo-300">Vendor Bills</div>
          <a routerLink="/finance/invoicing"><button pButton size="small" severity="secondary" label="New" icon="pi pi-plus"></button></a>
        </div>
        @if (dash(); as d) {
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5 self-center">
              <div class="flex items-center justify-between text-sm"><span class="text-indigo-600">{{ d.vendorBills.toValidate.count }} To Validate</span><span class="font-medium tabular-nums">{{ money(d.vendorBills.toValidate.amount) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-indigo-600">{{ d.vendorBills.unpaid.count }} To Pay</span><span class="font-medium tabular-nums">{{ money(d.vendorBills.unpaid.amount) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-rose-500">{{ d.vendorBills.late.count }} Late</span><span class="font-medium tabular-nums text-rose-500">{{ money(d.vendorBills.late.amount) }}</span></div>
            </div>
            <div>
              <div class="flex items-end justify-between gap-1 h-[96px] pt-2">
                @for (b of aging(d.vendorBills); track b.label) {
                  <div class="flex-1 flex flex-col items-center justify-end h-full">
                    <div class="w-full rounded-t" [class]="b.amount > 0 ? 'bg-indigo-300' : 'bg-surface-100 dark:bg-surface-800'" [style.height.%]="b.h" [title]="b.label + ': ' + money(b.amount)"></div>
                  </div>
                }
              </div>
              <div class="flex justify-between gap-1 mt-1">
                @for (b of aging(d.vendorBills); track b.label) {
                  <div class="flex-1 text-center text-[9px] leading-tight text-surface-400 truncate">{{ b.label }}</div>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Bank -->
      <div class="card p-5">
        <div class="flex items-start justify-between mb-3">
          <div class="text-[15px] font-semibold text-surface-800 dark:text-surface-100">Bank</div>
          <div class="flex items-center gap-2">
            <a routerLink="/finance/accounting"><button pButton size="small" severity="secondary" label="Transactions"></button></a>
            @if ((dash()?.bank?.toReconcile ?? 0) > 0) { <span class="text-xs text-brand-600 font-medium">{{ dash()?.bank?.toReconcile }} to reconcile</span> }
          </div>
        </div>
        @if (dash()?.bank; as b) {
          <div class="grid grid-cols-2 gap-4 items-center">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Balance</span><span class="font-medium tabular-nums">{{ money(b.balance) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Last Statement</span><span class="font-medium tabular-nums">{{ money(b.lastStatement) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Payments</span><span class="font-medium tabular-nums">{{ money(b.payments) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Misc. Operations</span><span class="font-medium tabular-nums">{{ money(b.miscOperations) }}</span></div>
            </div>
            <div [innerHTML]="spark(b.trend, '#7c3aed')"></div>
          </div>
        }
      </div>

      <!-- Cash -->
      <div class="card p-5">
        <div class="flex items-start justify-between mb-3">
          <div class="text-[15px] font-semibold text-surface-800 dark:text-surface-100">Cash</div>
          <a routerLink="/finance/accounting"><button pButton size="small" severity="secondary" label="Transactions"></button></a>
        </div>
        @if (dash()?.cash; as c) {
          <div class="grid grid-cols-2 gap-4 items-center">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Balance</span><span class="font-medium tabular-nums">{{ money(c.balance) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Payments</span><span class="font-medium tabular-nums">{{ money(c.payments) }}</span></div>
              <div class="flex items-center justify-between text-sm"><span class="text-surface-500">Transactions</span><span class="font-medium tabular-nums">{{ c.transactions ?? 0 }}</span></div>
            </div>
            <div [innerHTML]="spark(c.trend, '#0d9488')"></div>
          </div>
        }
      </div>
    </div>
  `
})
export class AccountingDashboardComponent {
  private readonly svc = inject(FinanceService);
  private readonly san = inject(DomSanitizer);
  protected readonly dash = signal<FinanceDashboard | null>(null);

  constructor() { this.svc.dashboard().subscribe((d) => this.dash.set(d)); }

  money(n: number): string {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  aging(card: DocCard): { label: string; amount: number; h: number }[] {
    const max = Math.max(...card.aging.map((a) => a.amount), 1);
    return card.aging.map((a) => ({ label: a.label, amount: a.amount, h: Math.max(a.amount > 0 ? 6 : 0, Math.round((a.amount / max) * 100)) }));
  }

  /** A tiny inline-SVG area sparkline from a trend series. */
  spark(trend: number[], color: string): SafeHtml {
    const w = 200, h = 96, pad = 4;
    if (!trend || trend.length < 2) return '';
    const min = Math.min(...trend), max = Math.max(...trend);
    const range = max - min || 1;
    const step = (w - pad * 2) / (trend.length - 1);
    const pts = trend.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
    const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${pad},${h - pad} ${line} ${(pad + (trend.length - 1) * step).toFixed(1)},${h - pad}`;
    return this.san.bypassSecurityTrustHtml(`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:96px">
      <polygon points="${area}" fill="${color}" opacity="0.10"></polygon>
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
    </svg>`);
  }
}
