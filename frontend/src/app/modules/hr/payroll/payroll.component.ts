import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';

interface PayrollRow {
  employeeId: string; name: string; code: string; department: string; designation: string; avatarUrl?: string;
  paidDays: number; basic: number; hra: number; special: number; conveyance: number; bonus: number; gross: number;
  pf: number; esi: number; pt: number; tds: number; otherDeductions: number; totalDeductions: number; net: number;
}
interface PayrollSummary {
  employees: number; gross: number; net: number; pf: number; esi: number; pt: number; tds: number;
  statutory: number; ctcOutflow: number; avgNet: number; prevNet: number; netDeltaPct: number;
}
interface DeptCost { department: string; employees: number; gross: number; net: number; }
interface PayrollRegister {
  year: number; month: number; label: string; status: string;
  summary: PayrollSummary; departments: DeptCost[]; rows: PayrollRow[];
}
interface PayrollMonth { month: number; label: string; employees: number; gross: number; net: number; statutory: number; tds: number; status: string; }
interface PayrollYear { year: number; totals: { gross: number; net: number; statutory: number; tds: number; paidMonths: number; peakNet: number }; months: PayrollMonth[]; }

// ---- Employee self-service (ESS) ----
interface DeclItem { key: string; label: string; amount: number; }
interface DeclSection { code: string; label: string; limit: number | null; declared: number; items: DeclItem[]; }
interface DeclarationDto { year: number; sections: DeclSection[]; }
interface RegimeResult { regime: string; grossIncome: number; standardDeduction: number; totalDeductions: number; taxableIncome: number; tax: number; deductionLines: { label: string; amount: number }[]; }
interface CompareTaxDto { year: number; grossIncome: number; oldRegime: RegimeResult; newRegime: RegimeResult; recommended: string; saving: number; }
interface MyPayroll {
  year: number;
  employee: { code: string; name: string; department: string; designation: string; ctcAnnual: number };
  slip: PayrollRow | null;
  salaryVsTax: { month: number; label: string; net: number; tax: number; status: string }[];
  investmentUtilisation: { declared: number; limit: number; remaining: number };
  annualTax: number;
  paidDays: { month: number; label: string; days: number }[];
}
interface CtcComponent { label: string; monthly?: number; annual: number; }
interface CtcDto {
  year: number; annualCtc: number; monthlyGross: number; grossEarningsAnnual: number; benefitsAnnual: number;
  earnings: CtcComponent[]; employerContributions: CtcComponent[];
}

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [
    DecimalPipe, TitleCasePipe, FormsModule, TableModule, ButtonModule, TabsModule, DialogModule, SelectModule,
    InputTextModule, DatePickerModule, TooltipModule, ProgressBarModule,
    PageHeaderComponent, StatusPillComponent, AvatarComponent, HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Compensation" title="Payroll" subtitle="Cycles, tax declarations, statutory contributions and slip generation.">
      <button pButton severity="secondary" outlined icon="pi pi-download" label="Export" (click)="exportRegister()"></button>
      <button pButton icon="pi pi-play" label="Run payroll" (click)="runVisible = true"></button>
    </app-page-header>

    <app-hr-agent-rail [keys]="['active.payroll', 'active.copilot']" title="Payroll co-pilots" />

    <div class="card">
      <p-tabs value="mypay">
        <p-tablist>
          <p-tab value="mypay">My Payroll</p-tab>
          <p-tab value="declaration">Investment Declaration</p-tab>
          <p-tab value="comparetax">Compare Tax</p-tab>
          <p-tab value="ctc">CTC Details</p-tab>
          <p-tab value="form12bb">Form 12BB</p-tab>
          <p-tab value="documents">Documents</p-tab>
          <p-tab value="overview">Overview</p-tab>
          <p-tab value="register">Register (employee-wise)</p-tab>
          <p-tab value="yearly">Yearly</p-tab>
        </p-tablist>
        <p-tabpanels>
          <!-- ===================== MY PAYROLL (ESS) ===================== -->
          <p-tabpanel value="mypay">
            @if (myPay(); as m) {
              <div class="p-2 space-y-4">
                <!-- KPIs -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Annual CTC</div>
                    <div class="text-xl font-semibold tabular-nums">₹{{ m.employee.ctcAnnual | number: '1.0-0' }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Net pay / month</div>
                    <div class="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">₹{{ (m.slip?.net || 0) | number: '1.0-0' }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Tax deducted (YTD)</div>
                    <div class="text-xl font-semibold tabular-nums">₹{{ m.annualTax | number: '1.0-0' }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Investment declared</div>
                    <div class="text-xl font-semibold tabular-nums">₹{{ m.investmentUtilisation.declared | number: '1.0-0' }}</div>
                    <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden mt-2">
                      <div class="h-full rounded-full bg-brand-500" [style.width.%]="util(m)"></div>
                    </div>
                    <div class="text-[11px] text-surface-400 mt-1">of ₹{{ m.investmentUtilisation.limit | number: '1.0-0' }} eligible</div>
                  </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <!-- Salary vs Tax -->
                  <div class="card p-4 lg:col-span-2">
                    <div class="section-title mb-3">Salary vs tax — {{ m.year }}-{{ m.year + 1 }}</div>
                    <p-table [value]="m.salaryVsTax" responsiveLayout="scroll" styleClass="!border-0 text-sm" [scrollable]="true" scrollHeight="320px">
                      <ng-template pTemplate="header">
                        <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                          <th class="!text-xs !uppercase !text-surface-500">Month</th>
                          <th class="!text-xs !uppercase !text-surface-500 !text-right">Net pay</th>
                          <th class="!text-xs !uppercase !text-surface-500 !text-right">Tax</th>
                          <th class="!text-xs !uppercase !text-surface-500">Status</th>
                        </tr>
                      </ng-template>
                      <ng-template pTemplate="body" let-r>
                        <tr>
                          <td>{{ r.label }}</td>
                          <td class="text-right tabular-nums">{{ r.net ? ('₹' + (r.net | number: '1.0-0')) : '—' }}</td>
                          <td class="text-right tabular-nums text-amber-600 dark:text-amber-400">{{ r.tax ? ('₹' + (r.tax | number: '1.0-0')) : '—' }}</td>
                          <td><app-status-pill [tone]="statusTone(r.status)">{{ r.status | titlecase }}</app-status-pill></td>
                        </tr>
                      </ng-template>
                    </p-table>
                  </div>

                  <!-- Salary breakup -->
                  <div class="card p-4">
                    <div class="section-title mb-3">Monthly salary breakup</div>
                    @if (m.slip; as s) {
                      <div class="space-y-1.5 text-sm">
                        <div class="flex justify-between"><span class="text-surface-500">Basic</span><span class="tabular-nums">₹{{ s.basic | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between"><span class="text-surface-500">HRA</span><span class="tabular-nums">₹{{ s.hra | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between"><span class="text-surface-500">Special allowance</span><span class="tabular-nums">₹{{ s.special | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between"><span class="text-surface-500">Conveyance</span><span class="tabular-nums">₹{{ s.conveyance | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between font-semibold border-t border-surface-200 dark:border-surface-800 pt-1.5"><span>Gross</span><span class="tabular-nums">₹{{ s.gross | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between text-rose-600 dark:text-rose-400"><span>PF</span><span class="tabular-nums">−₹{{ s.pf | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between text-rose-600 dark:text-rose-400"><span>Professional tax</span><span class="tabular-nums">−₹{{ s.pt | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between text-rose-600 dark:text-rose-400"><span>TDS</span><span class="tabular-nums">−₹{{ s.tds | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between font-semibold border-t border-surface-200 dark:border-surface-800 pt-1.5 text-emerald-600 dark:text-emerald-400"><span>Net pay</span><span class="tabular-nums">₹{{ s.net | number: '1.0-0' }}</span></div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>

          <!-- ===================== INVESTMENT DECLARATION ===================== -->
          <p-tabpanel value="declaration">
            @if (declaration(); as d) {
              <div class="p-2 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-semibold">Investment declaration · FY {{ d.year }}-{{ d.year + 1 }}</div>
                    <div class="text-xs text-surface-500">Declare your tax-saving investments. Check the impact with Compare Tax before saving.</div>
                  </div>
                  <div class="flex gap-2">
                    <button pButton severity="secondary" outlined icon="pi pi-calculator" label="Compare tax" (click)="loadCompare()"></button>
                    <button pButton icon="pi pi-save" label="Save declaration" (click)="saveDeclaration()"></button>
                  </div>
                </div>

                @for (s of d.sections; track s.code) {
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-sm font-semibold">{{ s.label }}</span>
                      @if (s.limit) {
                        <span class="text-xs" [class.text-rose-600]="sectionTotal(s) > s.limit" [class.text-surface-500]="sectionTotal(s) <= s.limit">
                          ₹{{ sectionTotal(s) | number: '1.0-0' }} / ₹{{ s.limit | number: '1.0-0' }} limit
                        </span>
                      }
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      @for (it of s.items; track it.key) {
                        <div class="flex items-center gap-2">
                          <label class="text-sm flex-1 min-w-0 truncate" [pTooltip]="it.label">{{ it.label }}</label>
                          @if (it.key.endsWith('.metro')) {
                            <p-select [options]="metroOptions" [(ngModel)]="declAmounts[it.key]" styleClass="!rounded-lg w-28" />
                          } @else {
                            <input type="number" min="0" [(ngModel)]="declAmounts[it.key]" class="p-inputtext !rounded-lg w-32 text-right tabular-nums" placeholder="0" />
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>

          <!-- ===================== COMPARE TAX ===================== -->
          <p-tabpanel value="comparetax">
            <div class="p-2 space-y-4">
              <div class="flex items-center justify-between">
                <div class="text-lg font-semibold">Compare tax — Old vs New regime</div>
                <button pButton severity="secondary" outlined icon="pi pi-refresh" label="Recompute" (click)="loadCompare()"></button>
              </div>
              @if (compare(); as c) {
                <div class="rounded-xl p-4 flex items-center gap-3"
                  [class]="c.recommended === 'New' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-brand-50 dark:bg-brand-500/10'">
                  <i class="pi pi-check-circle text-lg" [class.text-emerald-600]="c.recommended === 'New'" [class.text-brand-600]="c.recommended === 'Old'"></i>
                  <div>
                    <div class="text-sm font-semibold">{{ c.recommended }} regime is better for you</div>
                    <div class="text-xs text-surface-500">You save approximately <b>₹{{ c.saving | number: '1.0-0' }}</b> in annual tax on a gross income of ₹{{ c.grossIncome | number: '1.0-0' }}.</div>
                  </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  @for (r of [c.oldRegime, c.newRegime]; track r.regime) {
                    <div class="rounded-xl border p-4"
                      [class.border-emerald-300]="c.recommended === r.regime" [class.dark:border-emerald-700]="c.recommended === r.regime"
                      [class.border-surface-200]="c.recommended !== r.regime" [class.dark:border-surface-800]="c.recommended !== r.regime">
                      <div class="flex items-center justify-between mb-3">
                        <span class="font-semibold">{{ r.regime }} regime</span>
                        @if (c.recommended === r.regime) { <app-status-pill tone="success">Recommended</app-status-pill> }
                      </div>
                      <div class="space-y-1 text-sm">
                        <div class="flex justify-between"><span class="text-surface-500">Gross income</span><span class="tabular-nums">₹{{ r.grossIncome | number: '1.0-0' }}</span></div>
                        @for (l of r.deductionLines; track l.label) {
                          <div class="flex justify-between text-surface-500"><span class="pl-3">− {{ l.label }}</span><span class="tabular-nums">₹{{ l.amount | number: '1.0-0' }}</span></div>
                        }
                        <div class="flex justify-between font-medium border-t border-surface-200 dark:border-surface-800 pt-1.5"><span>Taxable income</span><span class="tabular-nums">₹{{ r.taxableIncome | number: '1.0-0' }}</span></div>
                        <div class="flex justify-between text-base font-semibold mt-1"><span>Annual tax</span><span class="tabular-nums" [class.text-emerald-600]="c.recommended === r.regime">₹{{ r.tax | number: '1.0-0' }}</span></div>
                      </div>
                    </div>
                  }
                </div>
                <p class="text-[11px] text-surface-400"><i class="pi pi-info-circle mr-1"></i>Old regime reflects your saved declaration; the New regime allows only the standard deduction. Update the declaration tab and recompute to see the effect.</p>
              } @else {
                <div class="py-10 text-center text-surface-500">Click <b>Recompute</b> (or "Compare tax" on the declaration tab) to see your old vs new regime comparison.</div>
              }
            </div>
          </p-tabpanel>

          <!-- ===================== CTC DETAILS ===================== -->
          <p-tabpanel value="ctc">
            @if (ctc(); as c) {
              <div class="p-2 space-y-4">
                <div class="flex flex-wrap items-center gap-3">
                  <div class="rounded-xl bg-brand-50 dark:bg-brand-500/10 px-4 py-3">
                    <div class="text-xs text-surface-500">Total annual CTC</div>
                    <div class="text-2xl font-semibold tabular-nums text-brand-700 dark:text-brand-300">₹{{ c.annualCtc | number: '1.0-0' }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 px-4 py-3">
                    <div class="text-xs text-surface-500">Monthly gross</div>
                    <div class="text-xl font-semibold tabular-nums">₹{{ c.monthlyGross | number: '1.0-0' }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 px-4 py-3">
                    <div class="text-xs text-surface-500">Retirals & benefits (yr)</div>
                    <div class="text-xl font-semibold tabular-nums">₹{{ c.benefitsAnnual | number: '1.0-0' }}</div>
                  </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="card p-4">
                    <div class="section-title mb-3">Fixed earnings</div>
                    <table class="w-full text-sm">
                      <thead><tr class="text-surface-500 text-xs uppercase"><th class="text-left font-medium pb-2">Component</th><th class="text-right font-medium pb-2">Monthly</th><th class="text-right font-medium pb-2">Annual</th></tr></thead>
                      <tbody>
                        @for (e of c.earnings; track e.label) {
                          <tr class="border-t border-surface-100 dark:border-surface-800"><td class="py-1.5">{{ e.label }}</td><td class="text-right tabular-nums">₹{{ e.monthly | number: '1.0-0' }}</td><td class="text-right tabular-nums">₹{{ e.annual | number: '1.0-0' }}</td></tr>
                        }
                        <tr class="border-t border-surface-200 dark:border-surface-700 font-semibold"><td class="py-1.5">Gross earnings</td><td class="text-right tabular-nums">₹{{ c.monthlyGross | number: '1.0-0' }}</td><td class="text-right tabular-nums">₹{{ c.grossEarningsAnnual | number: '1.0-0' }}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="card p-4">
                    <div class="section-title mb-3">Employer contributions & benefits</div>
                    <table class="w-full text-sm">
                      <tbody>
                        @for (e of c.employerContributions; track e.label) {
                          <tr class="border-t border-surface-100 dark:border-surface-800 first:border-0"><td class="py-1.5">{{ e.label }}</td><td class="text-right tabular-nums">₹{{ e.annual | number: '1.0-0' }}</td></tr>
                        }
                        <tr class="border-t border-surface-200 dark:border-surface-700 font-semibold"><td class="py-1.5">Total CTC</td><td class="text-right tabular-nums">₹{{ c.annualCtc | number: '1.0-0' }}</td></tr>
                      </tbody>
                    </table>
                    <p class="text-[11px] text-surface-400 mt-3"><i class="pi pi-info-circle mr-1"></i>CTC = fixed gross earnings + employer PF + gratuity. Variable pay (bonus) is paid separately.</p>
                  </div>
                </div>
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>

          <!-- ===================== FORM 12BB ===================== -->
          <p-tabpanel value="form12bb">
            @if (declaration(); as d) {
              <div class="p-2 space-y-4">
                <div>
                  <div class="text-lg font-semibold">Form 12BB · FY {{ d.year }}-{{ d.year + 1 }}</div>
                  <div class="text-xs text-surface-500">Statement of particulars for claiming tax deductions — auto-built from your investment declaration.</div>
                </div>
                <div class="card p-4 overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-800">
                        <th class="text-left font-medium py-2 w-10">Sl</th>
                        <th class="text-left font-medium py-2">Nature of claim</th>
                        <th class="text-right font-medium py-2">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of d.sections; track s.code; let i = $index) {
                        <tr class="border-b border-surface-100 dark:border-surface-800">
                          <td class="py-2 text-surface-400">{{ i + 1 }}</td>
                          <td class="py-2">{{ s.label }} @if (s.limit) { <span class="text-[11px] text-surface-400">(limit ₹{{ s.limit | number: '1.0-0' }})</span> }</td>
                          <td class="py-2 text-right tabular-nums">₹{{ form12bbAmount(s) | number: '1.0-0' }}</td>
                        </tr>
                      }
                      <tr class="font-semibold border-t border-surface-200 dark:border-surface-700">
                        <td></td><td class="py-2">Total declared</td>
                        <td class="py-2 text-right tabular-nums">₹{{ form12bbTotal() | number: '1.0-0' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="text-[11px] text-surface-400"><i class="pi pi-verified mr-1"></i>Verification: I declare that the above particulars are true. Backed by the declaration saved on the Investment Declaration tab.</div>
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>

          <!-- ===================== DOCUMENTS ===================== -->
          <p-tabpanel value="documents">
            @if (myPay(); as m) {
              <div class="p-2 space-y-3">
                <div class="text-lg font-semibold">Salary documents · FY {{ m.year }}-{{ m.year + 1 }}</div>
                <div class="text-xs text-surface-500 mb-2">Download your monthly payslips and tax statement. Payslips are available once a month is processed.</div>
                <p-table [value]="m.salaryVsTax" responsiveLayout="scroll" styleClass="!border-0 text-sm">
                  <ng-template pTemplate="header">
                    <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                      <th class="!text-xs !uppercase !text-surface-500">Month</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Net pay</th>
                      <th class="!text-xs !uppercase !text-surface-500">Status</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Payslip</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-r>
                    <tr>
                      <td>{{ r.label }}</td>
                      <td class="text-right tabular-nums">{{ r.net ? ('₹' + (r.net | number: '1.0-0')) : '—' }}</td>
                      <td><app-status-pill [tone]="statusTone(r.status)">{{ r.status | titlecase }}</app-status-pill></td>
                      <td class="text-right">
                        @if (r.status !== 'scheduled') {
                          <button pButton size="small" [text]="true" icon="pi pi-download" label="Payslip" (click)="downloadPayslip(r)"></button>
                        } @else { <span class="text-[11px] text-surface-400">Not yet</span> }
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
                <div class="flex flex-wrap gap-2 pt-1">
                  <button pButton severity="secondary" outlined size="small" icon="pi pi-file" label="Annual taxsheet (CSV)" (click)="downloadTaxsheet()"></button>
                  <span class="text-[11px] text-surface-400 self-center"><i class="pi pi-info-circle mr-1"></i>Form 16 is issued by HR after the financial year closes.</span>
                </div>
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>

          <!-- ===================== OVERVIEW ===================== -->
          <p-tabpanel value="overview">
            @if (reg(); as d) {
              <div class="p-2 space-y-4">
                <div class="flex flex-wrap items-center gap-3">
                  <p-datepicker [(ngModel)]="month" (onSelect)="loadRegister()" view="month" dateFormat="MM yy" [showIcon]="true" inputStyleClass="!rounded-lg" />
                  <app-status-pill [tone]="statusTone(d.status)">{{ d.label }} · {{ d.status | titlecase }}</app-status-pill>
                  <span class="ml-auto text-xs text-surface-500">{{ d.summary.employees }} employees</span>
                </div>

                <!-- KPIs -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Gross payroll</div>
                    <div class="text-xl font-semibold tabular-nums">{{ inr(d.summary.gross) }}</div>
                    <div class="text-[11px] text-surface-500 mt-1">CTC outflow {{ inr(d.summary.ctcOutflow) }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Net disbursement</div>
                    <div class="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ inr(d.summary.net) }}</div>
                    <div class="text-[11px] mt-1" [class.text-emerald-600]="d.summary.netDeltaPct >= 0" [class.text-rose-600]="d.summary.netDeltaPct < 0">
                      <i class="pi" [class.pi-arrow-up-right]="d.summary.netDeltaPct >= 0" [class.pi-arrow-down-right]="d.summary.netDeltaPct < 0"></i>
                      {{ d.summary.netDeltaPct }}% vs last month
                    </div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">Statutory dues</div>
                    <div class="text-xl font-semibold tabular-nums">{{ inr(d.summary.statutory) }}</div>
                    <div class="text-[11px] text-surface-500 mt-1">PF + ESI + PT</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">TDS withheld</div>
                    <div class="text-xl font-semibold tabular-nums">{{ inr(d.summary.tds) }}</div>
                    <div class="text-[11px] text-surface-500 mt-1">Avg net {{ inr(d.summary.avgNet) }}/employee</div>
                  </div>
                </div>

                <!-- Cycle progress -->
                <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-5">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="section-title">Cycle progress · {{ d.label }}</div>
                      <div class="text-lg font-semibold mt-1">Step {{ cycle().step }} of 5 — {{ cycle().label }}</div>
                    </div>
                    <app-status-pill [tone]="statusTone(d.status)">{{ d.status | titlecase }}</app-status-pill>
                  </div>
                  <p-progressBar [value]="cycle().step * 20" [showValue]="false" styleClass="!h-2 mt-3" />
                  <ol class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs">
                    @for (st of steps; track st.n) {
                      <li class="rounded-lg p-3 font-medium"
                        [class]="st.n < cycle().step ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : st.n === cycle().step ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-500'">
                        {{ st.n < cycle().step ? '✓' : st.n === cycle().step ? '→' : '' }} {{ st.label }}
                      </li>
                    }
                  </ol>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- Statutory breakdown -->
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="section-title mb-3">Statutory & tax</div>
                    <dl class="space-y-2 text-sm">
                      <div class="flex justify-between"><dt class="text-surface-500">Provident Fund (PF)</dt><dd class="tabular-nums font-medium">₹{{ d.summary.pf | number: '1.0-0' }}</dd></div>
                      <div class="flex justify-between"><dt class="text-surface-500">ESI</dt><dd class="tabular-nums font-medium">₹{{ d.summary.esi | number: '1.0-0' }}</dd></div>
                      <div class="flex justify-between"><dt class="text-surface-500">Professional Tax (PT)</dt><dd class="tabular-nums font-medium">₹{{ d.summary.pt | number: '1.0-0' }}</dd></div>
                      <div class="flex justify-between border-t border-surface-200 dark:border-surface-800 pt-2"><dt class="font-medium">TDS (income tax)</dt><dd class="tabular-nums font-semibold">₹{{ d.summary.tds | number: '1.0-0' }}</dd></div>
                    </dl>
                  </div>

                  <!-- Department cost -->
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="section-title mb-3">Cost by department</div>
                    <div class="space-y-2.5">
                      @for (dep of d.departments; track dep.department) {
                        <div>
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-medium">{{ dep.department }} <span class="text-surface-400">· {{ dep.employees }}</span></span>
                            <span class="tabular-nums text-surface-500">{{ inr(dep.gross) }}</span>
                          </div>
                          <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                            <div class="h-full rounded-full bg-brand-500" [style.width.%]="d.summary.gross ? (dep.gross / d.summary.gross) * 100 : 0"></div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>

          <!-- ===================== REGISTER (employee-wise) ===================== -->
          <p-tabpanel value="register">
            @if (reg(); as d) {
              <div class="p-2 space-y-3">
                <div class="flex flex-wrap items-center gap-3">
                  <p-datepicker [(ngModel)]="month" (onSelect)="loadRegister()" view="month" dateFormat="MM yy" [showIcon]="true" inputStyleClass="!rounded-lg" />
                  <span class="relative flex-1 min-w-[14rem]">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input pInputText [(ngModel)]="search" (input)="onSearch()" placeholder="Search employee, code, department…" class="w-full !pl-10 !rounded-lg" />
                  </span>
                  <button pButton severity="secondary" outlined size="small" icon="pi pi-download" label="Export CSV" (click)="exportRegister()"></button>
                </div>

                <p-table [value]="d.rows" responsiveLayout="scroll" [rowHover]="true" [paginator]="d.rows.length > 12" [rows]="12">
                  <ng-template pTemplate="header">
                    <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                      <th class="!text-xs !uppercase !text-surface-500">Employee</th>
                      <th class="!text-xs !uppercase !text-surface-500">Department</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Gross</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Deductions</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">TDS</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Net pay</th>
                      <th class="!w-10"></th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-r>
                    <tr class="cursor-pointer" (click)="openSlip(r)">
                      <td>
                        <div class="flex items-center gap-3">
                          <app-avatar [name]="r.name" [image]="r.avatarUrl" size="sm" />
                          <div class="min-w-0">
                            <div class="font-medium truncate">{{ r.name }}</div>
                            <div class="text-[11px] text-surface-500">{{ r.code }} · {{ r.designation }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="text-sm">{{ r.department }}</td>
                      <td class="text-right tabular-nums">₹{{ r.gross | number: '1.0-0' }}</td>
                      <td class="text-right tabular-nums text-surface-500">₹{{ r.totalDeductions | number: '1.0-0' }}</td>
                      <td class="text-right tabular-nums text-surface-500">₹{{ r.tds | number: '1.0-0' }}</td>
                      <td class="text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">₹{{ r.net | number: '1.0-0' }}</td>
                      <td><button pButton text rounded size="small" icon="pi pi-file" pTooltip="View payslip" class="!text-surface-500" (click)="openSlip(r); $event.stopPropagation()"></button></td>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="footer">
                    <tr class="!bg-surface-50 dark:!bg-surface-900/40 font-semibold">
                      <td colspan="2" class="text-sm">Total · {{ d.summary.employees }} employees</td>
                      <td class="text-right tabular-nums">₹{{ d.summary.gross | number: '1.0-0' }}</td>
                      <td></td>
                      <td class="text-right tabular-nums">₹{{ d.summary.tds | number: '1.0-0' }}</td>
                      <td class="text-right tabular-nums text-emerald-600 dark:text-emerald-400">₹{{ d.summary.net | number: '1.0-0' }}</td>
                      <td></td>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="emptymessage">
                    <tr><td colspan="7" class="py-10 text-center text-surface-500">No employees match your search.</td></tr>
                  </ng-template>
                </p-table>
              </div>
            }
          </p-tabpanel>

          <!-- ===================== YEARLY ===================== -->
          <p-tabpanel value="yearly">
            @if (yr(); as y) {
              <div class="p-2 space-y-4">
                <div class="flex flex-wrap items-center gap-3">
                  <p-select [options]="yearOptions" [(ngModel)]="year" (onChange)="loadYear()" styleClass="!rounded-lg" />
                  <span class="text-xs text-surface-500">{{ y.totals.paidMonths }} months disbursed</span>
                </div>

                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">YTD gross</div><div class="text-xl font-semibold tabular-nums">{{ inr(y.totals.gross) }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">YTD net</div><div class="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ inr(y.totals.net) }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">YTD statutory</div><div class="text-xl font-semibold tabular-nums">{{ inr(y.totals.statutory) }}</div>
                  </div>
                  <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                    <div class="text-xs text-surface-500 mb-1">YTD TDS</div><div class="text-xl font-semibold tabular-nums">{{ inr(y.totals.tds) }}</div>
                  </div>
                </div>

                <!-- trend -->
                <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                  <div class="section-title mb-3">Net disbursement trend · {{ y.year }}</div>
                  <div class="flex items-end gap-2 h-40">
                    @for (m of y.months; track m.month) {
                      <div class="flex-1 flex flex-col items-center justify-end h-full gap-1" [pTooltip]="m.label + ': ' + (m.net ? inr(m.net) : '—')">
                        <div class="w-full rounded-t transition-all"
                          [class]="m.status === 'in progress' ? 'bg-amber-400' : m.status === 'paid' ? 'bg-brand-500' : 'bg-surface-200 dark:bg-surface-700'"
                          [style.height.%]="y.totals.peakNet ? (m.net / y.totals.peakNet) * 100 : 0"></div>
                        <span class="text-[10px] text-surface-400">{{ m.label.slice(0, 3) }}</span>
                      </div>
                    }
                  </div>
                </div>

                <p-table [value]="y.months" responsiveLayout="scroll" [rowHover]="true">
                  <ng-template pTemplate="header">
                    <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                      <th class="!text-xs !uppercase !text-surface-500">Month</th>
                      <th class="!text-xs !uppercase !text-surface-500">Status</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Employees</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Gross</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Statutory</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">TDS</th>
                      <th class="!text-xs !uppercase !text-surface-500 !text-right">Net</th>
                      <th class="!w-10"></th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-m>
                    <tr>
                      <td class="font-medium">{{ m.label }}</td>
                      <td><app-status-pill [tone]="statusTone(m.status)">{{ m.status | titlecase }}</app-status-pill></td>
                      <td class="text-right tabular-nums">{{ m.employees || '—' }}</td>
                      <td class="text-right tabular-nums">{{ m.gross ? ('₹' + (m.gross | number: '1.0-0')) : '—' }}</td>
                      <td class="text-right tabular-nums text-surface-500">{{ m.statutory ? ('₹' + (m.statutory | number: '1.0-0')) : '—' }}</td>
                      <td class="text-right tabular-nums text-surface-500">{{ m.tds ? ('₹' + (m.tds | number: '1.0-0')) : '—' }}</td>
                      <td class="text-right tabular-nums font-medium">{{ m.net ? ('₹' + (m.net | number: '1.0-0')) : '—' }}</td>
                      <td>
                        @if (m.status !== 'scheduled') {
                          <button pButton text rounded size="small" icon="pi pi-eye" pTooltip="Open month" class="!text-surface-500" (click)="openMonth(m)"></button>
                        }
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </div>
            } @else {
              <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
            }
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <!-- ===================== Payslip dialog ===================== -->
    <p-dialog [(visible)]="slipVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="'Payslip · ' + (slip()?.name || '')" [draggable]="false" [dismissableMask]="true">
      @if (slip(); as s) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <app-avatar [name]="s.name" [image]="s.avatarUrl" size="lg" />
              <div><div class="font-semibold">{{ s.name }}</div><div class="text-xs text-surface-500">{{ s.code }} · {{ s.designation }}</div></div>
            </div>
            <div class="text-right text-xs text-surface-500">{{ reg()?.label }}<br />{{ s.paidDays }} paid days</div>
          </div>

          <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div class="space-y-2">
              <div class="text-xs uppercase tracking-wider text-surface-400">Earnings</div>
              <div class="flex justify-between"><span class="text-surface-500">Basic</span><span class="tabular-nums">₹{{ s.basic | number: '1.0-0' }}</span></div>
              <div class="flex justify-between"><span class="text-surface-500">HRA</span><span class="tabular-nums">₹{{ s.hra | number: '1.0-0' }}</span></div>
              <div class="flex justify-between"><span class="text-surface-500">Special allowance</span><span class="tabular-nums">₹{{ s.special | number: '1.0-0' }}</span></div>
              <div class="flex justify-between"><span class="text-surface-500">Conveyance</span><span class="tabular-nums">₹{{ s.conveyance | number: '1.0-0' }}</span></div>
              @if (s.bonus > 0) { <div class="flex justify-between"><span class="text-surface-500">Bonus</span><span class="tabular-nums">₹{{ s.bonus | number: '1.0-0' }}</span></div> }
              <div class="flex justify-between font-semibold border-t border-surface-200 dark:border-surface-800 pt-1.5"><span>Gross</span><span class="tabular-nums">₹{{ s.gross | number: '1.0-0' }}</span></div>
            </div>
            <div class="space-y-2">
              <div class="text-xs uppercase tracking-wider text-surface-400">Deductions</div>
              <div class="flex justify-between"><span class="text-surface-500">Provident fund</span><span class="tabular-nums">₹{{ s.pf | number: '1.0-0' }}</span></div>
              @if (s.esi > 0) { <div class="flex justify-between"><span class="text-surface-500">ESI</span><span class="tabular-nums">₹{{ s.esi | number: '1.0-0' }}</span></div> }
              <div class="flex justify-between"><span class="text-surface-500">Professional tax</span><span class="tabular-nums">₹{{ s.pt | number: '1.0-0' }}</span></div>
              <div class="flex justify-between"><span class="text-surface-500">Income tax (TDS)</span><span class="tabular-nums">₹{{ s.tds | number: '1.0-0' }}</span></div>
              @if (s.otherDeductions > 0) { <div class="flex justify-between"><span class="text-surface-500">Other</span><span class="tabular-nums">₹{{ s.otherDeductions | number: '1.0-0' }}</span></div> }
              <div class="flex justify-between font-semibold border-t border-surface-200 dark:border-surface-800 pt-1.5"><span>Total</span><span class="tabular-nums">₹{{ s.totalDeductions | number: '1.0-0' }}</span></div>
            </div>
          </div>

          <div class="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5">
            <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300">Net pay</span>
            <span class="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">₹{{ s.net | number: '1.0-0' }}</span>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Download CSV" icon="pi pi-download" (click)="downloadSlip()"></button>
        <button pButton label="Close" (click)="slipVisible = false"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Run payroll dialog ===================== -->
    <p-dialog [(visible)]="runVisible" [modal]="true" [style]="{ width: '30rem' }" header="Run payroll" [draggable]="false" [dismissableMask]="true">
      @if (reg(); as d) {
        <div class="space-y-3 pt-1">
          <p class="text-sm text-surface-600 dark:text-surface-300">Process the <b>{{ d.label }}</b> payroll cycle for <b>{{ d.summary.employees }}</b> employees.</p>
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 p-3 text-sm space-y-1.5">
            <div class="flex justify-between"><span class="text-surface-500">Gross</span><span class="tabular-nums">₹{{ d.summary.gross | number: '1.0-0' }}</span></div>
            <div class="flex justify-between"><span class="text-surface-500">Statutory + TDS</span><span class="tabular-nums">₹{{ (d.summary.statutory + d.summary.tds) | number: '1.0-0' }}</span></div>
            <div class="flex justify-between font-semibold border-t border-surface-200 dark:border-surface-800 pt-1.5"><span>Net disbursement</span><span class="tabular-nums text-emerald-600 dark:text-emerald-400">₹{{ d.summary.net | number: '1.0-0' }}</span></div>
          </div>
          <p class="text-[11px] text-surface-500"><i class="pi pi-info-circle mr-1"></i>Salary inputs, tax and statutory contributions have been computed. Confirm to lock the cycle and queue disbursement.</p>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="runVisible = false"></button>
        <button pButton label="Confirm & process" icon="pi pi-check" (click)="confirmRun()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class PayrollComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/hr/payroll`;

  protected month = new Date();
  protected search = '';
  protected year = new Date().getFullYear();
  protected readonly yearOptions = [this.year - 2, this.year - 1, this.year, this.year + 1].map((y) => ({ label: String(y), value: y }));

  protected readonly reg = signal<PayrollRegister | null>(null);
  protected readonly yr = signal<PayrollYear | null>(null);

  // ESS state
  protected readonly myPay = signal<MyPayroll | null>(null);
  protected readonly declaration = signal<DeclarationDto | null>(null);
  protected readonly compare = signal<CompareTaxDto | null>(null);
  protected readonly ctc = signal<CtcDto | null>(null);
  protected declAmounts: Record<string, number> = {};
  protected readonly metroOptions = [{ label: 'Non-metro', value: 0 }, { label: 'Metro', value: 1 }];

  protected slipVisible = false;
  protected runVisible = false;
  protected readonly slip = signal<PayrollRow | null>(null);

  protected readonly steps = [
    { n: 1, label: 'Inputs collected' }, { n: 2, label: 'Tax computed' }, { n: 3, label: 'Verification' },
    { n: 4, label: 'Approval' }, { n: 5, label: 'Disburse' }
  ];

  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly cycle = computed(() => {
    const s = this.reg()?.status;
    if (s === 'paid') return { step: 5, label: 'Disbursed' };
    if (s === 'in progress') return { step: 3, label: 'Verification' };
    return { step: 1, label: 'Inputs collected' };
  });

  constructor() {
    this.loadRegister();
    this.loadYear();
    this.loadMyPay();
    this.loadDeclaration();
    this.loadCtc();
  }

  loadCtc() {
    this.http.get<CtcDto>(`${this.base}/ctc`).subscribe({ next: (d) => this.ctc.set(d), error: () => this.ctc.set(null) });
  }

  // ---- Form 12BB (built from the saved declaration) ----
  form12bbAmount(s: DeclSection): number {
    const total = this.sectionTotal(s);
    return s.limit ? Math.min(total, s.limit) : total;
  }
  form12bbTotal(): number {
    return (this.declaration()?.sections ?? []).reduce((sum, s) => sum + this.form12bbAmount(s), 0);
  }

  // ---- document downloads (reuses the existing download() helper) ----
  private csv(rows: (string | number)[][]): string {
    const cell = (v: string | number) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    return rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }
  downloadPayslip(r: { label: string; net: number }) {
    const m = this.myPay(); const s = m?.slip;
    if (!s) return;
    const rows: (string | number)[][] = [
      ['Payslip', r.label], ['Employee', m!.employee.name], ['Code', m!.employee.code], [''],
      ['Earnings', 'Amount'], ['Basic', s.basic], ['HRA', s.hra], ['Special allowance', s.special], ['Conveyance', s.conveyance], ['Gross', s.gross], [''],
      ['Deductions', 'Amount'], ['PF', s.pf], ['Professional tax', s.pt], ['TDS', s.tds], ['Total deductions', s.totalDeductions], [''],
      ['Net pay', r.net || s.net]
    ];
    this.download(`payslip-${r.label.replace(/\s+/g, '-')}.csv`, this.csv(rows));
    this.messages.add({ severity: 'success', summary: 'Payslip downloaded', detail: r.label });
  }
  downloadTaxsheet() {
    const m = this.myPay();
    if (!m) return;
    const rows: (string | number)[][] = [['Month', 'Net pay', 'Tax'], ...m.salaryVsTax.map((x) => [x.label, x.net || 0, x.tax || 0])];
    rows.push(['', '', ''], ['Annual tax (YTD)', '', m.annualTax]);
    this.download(`taxsheet-${m.year}.csv`, this.csv(rows));
    this.messages.add({ severity: 'success', summary: 'Taxsheet downloaded', detail: `FY ${m.year}-${m.year + 1}` });
  }

  loadRegister() {
    let params = new HttpParams().set('month', this.monthParam());
    if (this.search.trim()) params = params.set('search', this.search.trim());
    this.http.get<PayrollRegister>(`${this.base}/register`, { params }).subscribe((d) => this.reg.set(d));
  }

  // ---- ESS ----
  loadMyPay() {
    this.http.get<MyPayroll>(`${this.base}/me`).subscribe({ next: (d) => this.myPay.set(d), error: () => this.myPay.set(null) });
  }
  loadDeclaration() {
    this.http.get<DeclarationDto>(`${this.base}/declaration`).subscribe((d) => {
      this.declaration.set(d);
      const map: Record<string, number> = {};
      for (const s of d.sections) for (const it of s.items) map[it.key] = it.amount;
      this.declAmounts = map;
    });
  }
  loadCompare() {
    this.http.get<CompareTaxDto>(`${this.base}/compare-tax`).subscribe({
      next: (d) => this.compare.set(d),
      error: () => this.messages.add({ severity: 'warn', summary: 'Unavailable', detail: 'No salary record linked to your account.' })
    });
  }
  saveDeclaration() {
    const d = this.declaration();
    if (!d) return;
    const items = Object.entries(this.declAmounts).map(([key, amount]) => ({ key, amount: Number(amount) || 0 }));
    this.http.put(`${this.base}/declaration`, { year: d.year, items }).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Declaration saved', detail: `FY ${d.year}-${d.year + 1}` });
        this.loadDeclaration();
        this.loadCompare();
        this.loadMyPay();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not save your declaration.' })
    });
  }
  sectionTotal(s: DeclSection): number {
    return s.items.filter((i) => !i.key.endsWith('.metro')).reduce((sum, i) => sum + (Number(this.declAmounts[i.key]) || 0), 0);
  }
  util(m: MyPayroll): number {
    return m.investmentUtilisation.limit ? Math.min(100, (m.investmentUtilisation.declared / m.investmentUtilisation.limit) * 100) : 0;
  }

  loadYear() {
    this.http.get<PayrollYear>(`${this.base}/year`, { params: { year: String(this.year) } }).subscribe((d) => this.yr.set(d));
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadRegister(), 300);
  }

  openMonth(m: PayrollMonth) {
    this.month = new Date(this.year, m.month - 1, 1);
    this.loadRegister();
    this.messages.add({ severity: 'info', summary: m.label, detail: 'Opened in the register tab.' });
  }

  openSlip(r: PayrollRow) {
    this.slip.set(r);
    this.slipVisible = true;
  }

  confirmRun() {
    const d = this.reg();
    this.runVisible = false;
    this.messages.add({ severity: 'success', summary: 'Payroll processed', detail: `${d?.label} · ₹${(d?.summary.net ?? 0).toLocaleString('en-IN')} queued for disbursement.` });
  }

  exportRegister() {
    const d = this.reg();
    if (!d || !d.rows.length) {
      this.messages.add({ severity: 'info', summary: 'Nothing to export', detail: 'No payroll rows.' });
      return;
    }
    const headers = ['Code', 'Name', 'Department', 'Designation', 'Paid days', 'Basic', 'HRA', 'Special', 'Conveyance', 'Bonus', 'Gross', 'PF', 'ESI', 'PT', 'TDS', 'Other', 'Total deductions', 'Net'];
    const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = d.rows.map((r) => [r.code, r.name, r.department, r.designation, r.paidDays, r.basic, r.hra, r.special, r.conveyance, r.bonus, r.gross, r.pf, r.esi, r.pt, r.tds, r.otherDeductions, r.totalDeductions, r.net].map(cell).join(','));
    this.download(`payroll-${this.monthParam()}.csv`, [headers.join(','), ...lines].join('\r\n'));
    this.messages.add({ severity: 'success', summary: 'Export ready', detail: `${d.rows.length} rows · ${d.label}` });
  }

  downloadSlip() {
    const s = this.slip();
    if (!s) return;
    const rows = [
      ['Payslip', this.reg()?.label ?? ''], ['Employee', s.name], ['Code', s.code], ['Designation', s.designation], ['Department', s.department], ['Paid days', s.paidDays],
      ['Basic', s.basic], ['HRA', s.hra], ['Special allowance', s.special], ['Conveyance', s.conveyance], ['Bonus', s.bonus], ['Gross', s.gross],
      ['PF', s.pf], ['ESI', s.esi], ['Professional tax', s.pt], ['TDS', s.tds], ['Other deductions', s.otherDeductions], ['Total deductions', s.totalDeductions], ['Net pay', s.net]
    ];
    const csv = rows.map((r) => r.join(',')).join('\r\n');
    this.download(`payslip-${s.code}-${this.monthParam()}.csv`, csv);
  }

  private download(name: string, csv: string) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  statusTone(s: string): StatusTone {
    return s === 'paid' ? 'success' : s === 'in progress' ? 'warn' : 'neutral';
  }

  /** Compact Indian-format currency: ₹1.47 Cr / ₹2.33 L / ₹45,000. */
  inr(n: number): string {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  private monthParam(): string {
    return `${this.month.getFullYear()}-${String(this.month.getMonth() + 1).padStart(2, '0')}`;
  }
}
