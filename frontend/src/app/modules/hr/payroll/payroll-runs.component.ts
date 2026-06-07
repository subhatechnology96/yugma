import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';

interface Run { id: string; year: number; month: number; label: string; status: string; total: number; employees: number; runAt: string; }
interface Slip {
  id: string; employeeId: string; employee: string; code: string; department: string; designation: string;
  payableDays: number; lopDays: number; basic: number; hra: number; special: number; conveyance: number; bonus: number; otherEarnings: number;
  pf: number; esi: number; pt: number; tds: number; otherDeductions: number; lopDeduction: number; gross: number; totalDeductions: number; net: number; edited: boolean; notes?: string;
}
interface LineItem { label: string; amount: number; }
interface PayslipDoc {
  company: { name: string; legal: string };
  title: string;
  payPeriod: { from: string; to: string; label: string };
  employee: { id: string; personId: string; name: string; designation: string; department: string; band: string; doj?: string | null; location: string; pan: string; uan: string; pfNo: string; bankName: string; bankAccount: string; daysWorked: number; lwpCurrent: number };
  standardSalary: LineItem[]; totalStandard: number;
  earnings: LineItem[]; grossEarnings: number;
  deductions: LineItem[]; grossDeductions: number;
  netPay: number;
  tax: { currentMonthTaxable: number; projectedStandardSalary: number; grossSalary: number; standardDeduction: number; incomeUnderHeadSalary: number; grossTotalIncome: number; totalIncome: number; taxOnTotalIncome: number; healthEducationCess: number; taxPayable: number; taxDeductedSoFar: number; balanceTax: number };
  chapterVI: LineItem[];
  monthlyTax: { month: string; amount: number }[];
}

@Component({
  selector: 'app-payroll-runs',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, DialogModule, SelectModule, InputNumberModule, InputTextModule, TextareaModule, TooltipModule, ConfirmDialogModule, PageHeaderComponent, AvatarComponent],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-confirmDialog />
    <app-page-header eyebrow="Human Resources" title="Payroll" subtitle="Run monthly payroll, edit each employee's payslip and handle LOP from unpaid leave.">
      <p-select [options]="runOptions()" [(ngModel)]="selectedRunId" (ngModelChange)="loadRun($event)" optionLabel="label" optionValue="value" placeholder="Select a run" styleClass="!rounded-lg" appendTo="body" />
      <p-select [options]="monthOptions" [(ngModel)]="genMonth" optionLabel="label" optionValue="value" styleClass="!rounded-lg" appendTo="body" />
      <button pButton severity="secondary" outlined icon="pi pi-bolt" label="Run payroll" [loading]="busy()" (click)="generate()"></button>
    </app-page-header>

    @if (run(); as r) {
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">Period</div>
          <div class="text-[17px] leading-tight font-semibold mt-1">{{ r.label }}</div>
          <div class="text-[11px] mt-0.5"><span class="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide" [class]="statusTone(r.status)">{{ r.status }}</span></div>
        </div>
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Net payout</div><div class="text-[22px] leading-tight font-semibold mt-0.5 tabular-nums">{{ money(r.total) }}</div><div class="text-[11px] text-surface-400">to disburse</div></div>
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Employees</div><div class="text-[22px] leading-tight font-semibold mt-0.5 tabular-nums">{{ r.employees }}</div><div class="text-[11px] text-surface-400">on this run</div></div>
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">LOP deduction</div><div class="text-[22px] leading-tight font-semibold mt-0.5 tabular-nums" [class.text-rose-600]="totals().lop>0">{{ money(totals().lop) }}</div><div class="text-[11px] text-surface-400">{{ totals().lopDays }} days unpaid</div></div>
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Bonuses</div><div class="text-[22px] leading-tight font-semibold mt-0.5 tabular-nums">{{ money(totals().bonus) }}</div><div class="text-[11px] text-surface-400">added this run</div></div>
      </div>

      <!-- toolbar -->
      <div class="flex flex-wrap items-center gap-2 mb-3">
        @if (r.status === 'draft' || r.status === 'processing') {
          <div class="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 px-2 py-1.5">
            <span class="text-xs text-surface-500">{{ selected().length ? selected().length + ' selected' : 'All ' + slips().length }}</span>
            <p-inputNumber [(ngModel)]="bulkAmount" [min]="0" mode="currency" currency="INR" locale="en-IN" inputStyleClass="!rounded-md !py-1 !text-sm w-28" />
            <button pButton size="small" text class="!text-[11px]" label="Add bonus" (click)="bulk('bonus')"></button>
            <button pButton size="small" text class="!text-[11px] !text-rose-500" label="Add deduction" (click)="bulk('deduction')"></button>
            <span class="w-px h-5 bg-surface-200 dark:bg-surface-700"></span>
            <button pButton size="small" text class="!text-[11px]" icon="pi pi-refresh" label="Recompute LOP from leave" (click)="bulk('recompute-lop')"></button>
          </div>
        }
        <div class="ml-auto flex items-center gap-2">
          @if (r.status === 'draft') { <button pButton size="small" icon="pi pi-check" label="Approve run" (click)="setStatus('Approved')"></button> }
          @else if (r.status === 'approved') { <button pButton size="small" icon="pi pi-send" label="Mark paid" (click)="setStatus('Paid')"></button> }
          @else if (r.status === 'paid') { <span class="text-xs text-emerald-600"><i class="pi pi-check-circle"></i> Payroll paid</span> }
          @if (r.status !== 'draft' && r.status !== 'paid') { <button pButton size="small" severity="secondary" outlined label="Reopen" (click)="setStatus('Draft')"></button> }
        </div>
      </div>

      <div class="card overflow-hidden">
        <p-table [value]="slips()" [(selection)]="selectedRows" dataKey="id" responsiveLayout="scroll" [rowHover]="true" [paginator]="slips().length > 16" [rows]="16" class="p-1">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!w-10"><p-tableHeaderCheckbox /></th>
              <th class="!text-xs !uppercase !text-surface-500">Employee</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-center">Payable</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-center">LOP</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-right">Gross</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-right">Deductions</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-right">Net pay</th>
              <th class="!w-20"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-s>
            <tr>
              <td><p-tableCheckbox [value]="s" /></td>
              <td>
                <div class="flex items-center gap-2">
                  <app-avatar [name]="s.employee" size="xs" />
                  <div class="min-w-0">
                    <div class="text-sm font-medium truncate">{{ s.employee }} @if (s.edited) { <i class="pi pi-pencil text-[9px] text-brand-500 ml-0.5" pTooltip="Edited"></i> }</div>
                    <div class="text-[11px] text-surface-400 truncate">{{ s.code }} · {{ s.department }}</div>
                  </div>
                </div>
              </td>
              <td class="text-center tabular-nums text-sm">{{ s.payableDays }}</td>
              <td class="text-center tabular-nums text-sm" [class.text-rose-500]="s.lopDays > 0">{{ s.lopDays || '—' }}</td>
              <td class="text-right tabular-nums">{{ money(s.gross) }}@if (s.bonus > 0) { <span class="text-[10px] text-emerald-500 block">+{{ money(s.bonus) }} bonus</span> }</td>
              <td class="text-right tabular-nums text-surface-600 dark:text-surface-300">{{ money(s.totalDeductions) }}@if (s.lopDeduction > 0) { <span class="text-[10px] text-rose-500 block">−{{ money(s.lopDeduction) }} LOP</span> }</td>
              <td class="text-right tabular-nums font-semibold">{{ money(s.net) }}</td>
              <td (click)="$event.stopPropagation()" class="text-right whitespace-nowrap">
                <button pButton size="small" text rounded icon="pi pi-file" class="!text-surface-500" pTooltip="View payslip" (click)="openPayslip(s)"></button>
                @if (r.status === 'draft' || r.status === 'processing') {
                  <button pButton size="small" text rounded icon="pi pi-pencil" class="!text-surface-500" (click)="openEdit(s)"></button>
                }
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage"><tr><td colspan="8" class="py-12 text-center text-surface-500">No payslips. Click “Run payroll” to generate this month.</td></tr></ng-template>
        </p-table>
      </div>
    } @else {
      <div class="card p-12 text-center">
        <i class="pi pi-money-bill text-3xl text-surface-300"></i>
        <div class="text-sm text-surface-500 mt-3">No pay run selected. Pick a month and click <span class="font-medium">Run payroll</span> to generate payslips for every employee.</div>
      </div>
    }

    <!-- Edit payslip -->
    <p-dialog [(visible)]="editVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="'Edit payslip · ' + (editing()?.employee || '')" [draggable]="false" [dismissableMask]="true">
      @if (editing(); as s) {
        <div class="space-y-4 pt-1">
          <div class="grid grid-cols-3 gap-3 text-sm">
            <div class="rounded-lg bg-surface-50 dark:bg-surface-900/40 p-2.5"><div class="text-[10px] uppercase text-surface-400">Fixed monthly</div><div class="font-semibold tabular-nums">{{ money(s.basic + s.hra + s.special + s.conveyance) }}</div></div>
            <div class="rounded-lg bg-surface-50 dark:bg-surface-900/40 p-2.5"><div class="text-[10px] uppercase text-surface-400">Statutory</div><div class="font-semibold tabular-nums">{{ money(s.pf + s.esi + s.pt + s.tds) }}</div></div>
            <div class="rounded-lg bg-surface-50 dark:bg-surface-900/40 p-2.5"><div class="text-[10px] uppercase text-surface-400">Payable days</div><div class="font-semibold tabular-nums">{{ s.payableDays }}</div></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="text-xs font-medium text-surface-600">LOP days (unpaid)</label><p-inputNumber [(ngModel)]="form.lopDays" [min]="0" [max]="s.payableDays" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
            <div><label class="text-xs font-medium text-surface-600">Bonus</label><p-inputNumber [(ngModel)]="form.bonus" [min]="0" mode="currency" currency="INR" locale="en-IN" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
            <div><label class="text-xs font-medium text-surface-600">Other earnings</label><p-inputNumber [(ngModel)]="form.otherEarnings" [min]="0" mode="currency" currency="INR" locale="en-IN" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
            <div><label class="text-xs font-medium text-surface-600">Other deductions</label><p-inputNumber [(ngModel)]="form.otherDeductions" [min]="0" mode="currency" currency="INR" locale="en-IN" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
            <div class="col-span-2"><label class="text-xs font-medium text-surface-600">Note</label><textarea pTextarea [(ngModel)]="form.notes" rows="2" class="w-full mt-1 !rounded-lg" placeholder="Reason for adjustment"></textarea></div>
          </div>
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 p-3 flex items-center justify-between">
            <span class="text-sm text-surface-500">Estimated net pay</span>
            <span class="text-lg font-semibold tabular-nums">{{ money(previewNet(s)) }}</span>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="editVisible = false"></button>
        <button pButton label="Save payslip" icon="pi pi-check" [loading]="busy()" (click)="saveEdit()"></button>
      </ng-template>
    </p-dialog>

    <!-- Payslip preview + download -->
    <p-dialog [(visible)]="payslipVisible" [modal]="true" [style]="{ width: '980px', maxWidth: '96vw' }" header="Payslip" [draggable]="false" [dismissableMask]="true">
      <div class="overflow-auto bg-white p-2" [innerHTML]="payslipHtml()"></div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Close" (click)="payslipVisible = false"></button>
        <button pButton label="Download PDF" icon="pi pi-download" (click)="downloadPayslip()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class PayrollRunsComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly san = inject(DomSanitizer);
  private readonly base = `${environment.apiBaseUrl}/my-work/payroll`;

  payslipVisible = false;
  private payslipRaw = '';
  protected readonly payslipHtml = signal<SafeHtml>('');

  protected readonly runs = signal<Run[]>([]);
  protected readonly run = signal<Run | null>(null);
  protected readonly slips = signal<Slip[]>([]);
  protected readonly busy = signal(false);
  selectedRunId: string | null = null;
  selectedRows: Slip[] = [];
  bulkAmount = 5000;
  genMonth = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;

  protected readonly monthOptions = (() => {
    const out: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: d.toLocaleString(undefined, { month: 'long', year: 'numeric' }), value: `${d.getFullYear()}-${d.getMonth() + 1}` });
    }
    return out;
  })();

  editVisible = false;
  protected readonly editing = signal<Slip | null>(null);
  form = { lopDays: 0, bonus: 0, otherEarnings: 0, otherDeductions: 0, notes: '' };

  constructor() { this.loadRuns(); }

  loadRuns() {
    this.http.get<Run[]>(`${this.base}/runs`).subscribe((rs) => {
      this.runs.set(rs);
      if (rs.length && !this.run()) { this.selectedRunId = rs[0].id; this.loadRun(rs[0].id); }
    });
  }
  protected readonly runOptions = computed(() => this.runs().map((r) => ({ label: `${r.label} · ${r.status}`, value: r.id })));

  loadRun(id: string) {
    if (!id) return;
    this.http.get<{ run: Run; payslips: Slip[] }>(`${this.base}/runs/${id}`).subscribe((d) => { this.run.set(d.run); this.slips.set(d.payslips); this.selectedRows = []; });
  }

  generate() {
    const [y, m] = this.genMonth.split('-').map(Number);
    this.busy.set(true);
    this.http.post<{ run: Run; payslips: Slip[] }>(`${this.base}/runs`, { year: y, month: m }).subscribe({
      next: (d) => { this.busy.set(false); this.run.set(d.run); this.slips.set(d.payslips); this.selectedRunId = d.run.id; this.loadRuns(); this.messages.add({ severity: 'success', summary: 'Payroll run ready', detail: `${d.run.label} · ${d.payslips.length} payslips` }); },
      error: () => { this.busy.set(false); this.messages.add({ severity: 'error', summary: 'Could not run payroll' }); }
    });
  }

  protected readonly selected = computed(() => this.selectedRows);
  protected readonly totals = computed(() => {
    const s = this.slips();
    return { lop: s.reduce((a, x) => a + x.lopDeduction, 0), lopDays: s.reduce((a, x) => a + x.lopDays, 0), bonus: s.reduce((a, x) => a + x.bonus, 0) };
  });

  bulk(action: 'bonus' | 'deduction' | 'recompute-lop') {
    const r = this.run(); if (!r) return;
    const ids = this.selectedRows.map((x) => x.id);
    const body: Record<string, unknown> = { action, payslipIds: ids.length ? ids : null };
    if (action !== 'recompute-lop') body['amount'] = this.bulkAmount;
    this.http.post<{ updated: number }>(`${this.base}/runs/${r.id}/bulk`, body).subscribe((res) => {
      this.messages.add({ severity: 'success', summary: 'Bulk update applied', detail: `${res.updated} payslip(s)` });
      this.loadRun(r.id);
    });
  }

  openEdit(s: Slip) {
    this.editing.set(s);
    this.form = { lopDays: s.lopDays, bonus: s.bonus, otherEarnings: s.otherEarnings, otherDeductions: s.otherDeductions, notes: s.notes ?? '' };
    this.editVisible = true;
  }
  previewNet(s: Slip): number {
    const fixed = s.basic + s.hra + s.special + s.conveyance;
    const lop = s.payableDays > 0 ? Math.round((fixed / s.payableDays) * (this.form.lopDays || 0)) : 0;
    const gross = fixed + (this.form.bonus || 0) + (this.form.otherEarnings || 0);
    return gross - (s.pf + s.esi + s.pt + s.tds + lop + (this.form.otherDeductions || 0));
  }
  saveEdit() {
    const r = this.run(); const s = this.editing(); if (!r || !s) return;
    this.busy.set(true);
    this.http.put<Slip>(`${this.base}/runs/${r.id}/payslips/${s.id}`, { ...this.form }).subscribe({
      next: () => { this.busy.set(false); this.editVisible = false; this.messages.add({ severity: 'success', summary: 'Payslip updated', detail: s.employee }); this.loadRun(r.id); },
      error: () => { this.busy.set(false); this.messages.add({ severity: 'error', summary: 'Save failed' }); }
    });
  }

  setStatus(status: string) {
    const r = this.run(); if (!r) return;
    const apply = () => this.http.post<Run>(`${this.base}/runs/${r.id}/status`, { status }).subscribe(() => { this.messages.add({ severity: 'success', summary: `Run ${status.toLowerCase()}` }); this.loadRun(r.id); this.loadRuns(); });
    if (status === 'Paid' || status === 'Approved') {
      this.confirm.confirm({ header: `${status} payroll`, message: `${status} the ${r.label} pay run for ${r.employees} employees (${this.money(r.total)})?`, accept: apply });
    } else apply();
  }

  // ---- payslip document ----
  openPayslip(s: Slip) {
    const r = this.run(); if (!r) return;
    this.http.get<PayslipDoc>(`${this.base}/runs/${r.id}/payslips/${s.id}/document`).subscribe((doc) => {
      this.payslipRaw = this.buildPayslip(doc);
      this.payslipHtml.set(this.san.bypassSecurityTrustHtml(this.payslipRaw));
      this.payslipVisible = true;
    });
  }
  downloadPayslip() {
    const w = window.open('', '_blank', 'width=1024,height=820');
    if (!w) { this.messages.add({ severity: 'warn', summary: 'Allow pop-ups to download the payslip' }); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip</title></head><body style="margin:0" onload="setTimeout(function(){window.print()},150)">${this.payslipRaw}</body></html>`);
    w.document.close();
  }

  private buildPayslip(d: PayslipDoc): string {
    const f = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB').replace(/\//g, '.') : '—');
    const e = d.employee;
    const kv = (rows: [string, string][]) => `<table style="border:none">${rows.map(([k, v]) => `<tr class="nb"><td class="lbl">${k}</td><td class="cl">:</td><td>${v}</td></tr>`).join('')}</table>`;
    const left: [string, string][] = [
      ['Employee ID', e.id], ['Person ID', e.personId], ['Designation', e.designation], ['DOJ / Gender', `${dt(e.doj)}`],
      ['PAN No', e.pan], ['PF // Pension No', e.pfNo], ['UAN No', e.uan]
    ];
    const right: [string, string][] = [
      ['Bank Name & Account No', `${e.bankName} ${e.bankAccount}`], ['Location (CWL)', e.location], ['Department', e.department], ['Band', e.band],
      ['Days worked in month', f(e.daysWorked)], ['LWP Current/Previous Month', `${e.lwpCurrent.toFixed(2)}/0.00`], ['Sabbatical Leave Current/Previous Mon', '0.00/0.00']
    ];
    const maxLen = Math.max(d.standardSalary.length, d.earnings.length, d.deductions.length);
    const cell = (arr: { label: string; amount: number }[], i: number) => arr[i] ? `<td>${arr[i].label}</td><td class="r">${f(arr[i].amount)}</td>` : '<td></td><td></td>';
    let salaryRows = '';
    for (let i = 0; i < maxLen; i++) salaryRows += `<tr>${cell(d.standardSalary, i)}${cell(d.earnings, i)}${cell(d.deductions, i)}</tr>`;
    const t = d.tax;
    const projected: [string, string][] = [
      ['Taxable Income till Pr. Month', f(t.projectedStandardSalary - t.currentMonthTaxable)], ['Current Mth Taxable income', f(t.currentMonthTaxable)],
      ['Projected Standard Salary', f(t.projectedStandardSalary)], ['Gross Salary', f(t.grossSalary)], ['Standard Deduction', f(t.standardDeduction)],
      ['Income under Head Salary', f(t.incomeUnderHeadSalary)], ['Gross Total Income', f(t.grossTotalIncome)], ['Total Income', f(t.totalIncome)],
      ['Tax on Total Income', f(t.taxOnTotalIncome)], ['Health and Education cess', f(t.healthEducationCess)], ['Tax payable', f(t.taxPayable)],
      ['Tax deducted so far', f(t.taxDeductedSoFar)], ['Balance Tax', f(t.balanceTax)]
    ];
    const chapter = d.chapterVI.map((c) => `<tr class="nb"><td>${c.label}</td><td class="r">${f(c.amount)}</td></tr>`).join('')
      + `<tr class="nb b"><td>Total</td><td class="r">${f(d.chapterVI.reduce((a, c) => a + c.amount, 0))}</td></tr>`;
    const monthly = d.monthlyTax.map((m) => `<tr class="nb"><td>${m.month}</td><td class="r">${f(m.amount)}</td></tr>`).join('')
      + `<tr class="nb b"><td>Total</td><td class="r">${f(d.monthlyTax.reduce((a, m) => a + m.amount, 0))}</td></tr>`;

    return `<style>
      .payslip{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11px;width:920px;margin:0 auto;border:1px solid #000;background:#fff}
      .payslip table{border-collapse:collapse;width:100%}
      .payslip td,.payslip th{border:1px solid #000;padding:2px 6px;vertical-align:top}
      .payslip .nb td,.payslip table.nb td{border:none;padding:1px 4px}
      .payslip .lbl{font-weight:bold;white-space:nowrap}.payslip .cl{width:8px}
      .payslip .r{text-align:right}.payslip .b{font-weight:bold}
      .payslip .sec{background:#e8e8e8;font-weight:bold}
      .payslip .center{text-align:center}
    </style>
    <div class="payslip">
      <table><tr>
        <td style="border:none" class="center">
          <div class="b" style="font-size:13px">${d.title}</div>
          <div>${d.payPeriod.label}</div>
          <div class="b" style="font-size:12px;margin-top:2px">${e.name}</div>
        </td>
        <td style="border:none;width:180px;text-align:right">
          <div class="b" style="color:#1e7fc2;font-size:16px">${d.company.name}</div>
          <div>${d.company.legal}</div>
        </td>
      </tr></table>
      <table><tr>
        <td style="width:50%">${kv(left)}</td>
        <td style="width:50%">${kv(right)}</td>
      </tr></table>
      <table>
        <tr class="sec"><td>Standard Monthly Salary</td><td class="r">INR</td><td>Earnings</td><td class="r">INR</td><td>Deductions</td><td class="r">INR</td></tr>
        ${salaryRows}
        <tr class="b"><td>Total Standard Salary</td><td class="r">${f(d.totalStandard)}</td><td>Gross Earnings</td><td class="r">${f(d.grossEarnings)}</td><td>Gross Deductions</td><td class="r">${f(d.grossDeductions)}</td></tr>
        <tr class="b"><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td class="sec">Net Pay</td><td class="r sec">${f(d.netPay)}</td></tr>
      </table>
      <table>
        <tr class="sec center"><td colspan="4">Income Tax Computation</td></tr>
        <tr class="sec center"><td>Exemption U/S 10</td><td>Projected / Actual Taxable Salary</td><td>Contribution under Chapter VI A</td><td>Monthly Tax Deduction</td></tr>
        <tr>
          <td style="width:22%"></td>
          <td style="width:34%">${kv(projected)}</td>
          <td style="width:22%"><table class="nb">${chapter}</table></td>
          <td style="width:22%"><table class="nb">${monthly}</table></td>
        </tr>
      </table>
      <div style="padding:6px;font-size:9px;line-height:1.4">
        *This is a computer generated payslip and doesn't require signature or any company seal.<br>
        *The current month pay slip has got generated after consideration of payroll input i.e. compensation letter, flexi declaration and approved inputs.<br>
        <div class="center b" style="margin-top:4px">Page 1 of 1</div>
      </div>
    </div>`;
  }

  money(n: number): string { return '₹' + Math.round(n).toLocaleString('en-IN'); }
  statusTone(s: string): string {
    return ({ draft: 'bg-surface-100 text-surface-500 dark:bg-surface-800', processing: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', approved: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300', paid: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' } as Record<string, string>)[s] ?? '';
  }
}
