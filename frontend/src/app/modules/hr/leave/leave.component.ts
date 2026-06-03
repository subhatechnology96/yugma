import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { EmployeeService } from '../services/employee.service';
import { HrAccessService } from '@core/services/hr-access.service';

interface LeaveRow {
  id: string;
  employeeId: string | null;
  employee: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
  appliedOn: string;
  approver: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

interface TypeBalance {
  type: string;
  entitled: number;
  carriedForward: number;
  used: number;
  pending: number;
  available: number;
}

interface EmployeeBalance {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  avatarUrl?: string;
  totalEntitled: number;
  totalCarriedForward: number;
  totalUsed: number;
  totalPending: number;
  totalAvailable: number;
  byType: TypeBalance[];
}

interface Holiday { date: string; name: string; type: string; }
interface HolidaysResponse { year: number; publicHolidays: Holiday[]; optionalHolidays: Holiday[]; }

interface LeaveSummary {
  pending: number;
  approvedMtd: number;
  rejectedMtd: number;
  onLeaveToday: number;
  balanceAvg: number;
}

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TabsModule,
    DialogModule,
    SelectModule,
    InputTextModule,
    TooltipModule,
    PageHeaderComponent,
    KpiCardComponent,
    StatusPillComponent,
    AvatarComponent,
    HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Time off" title="Leave management" subtitle="Apply, approve, reject, change and track leave across the company.">
      <button pButton severity="secondary" [outlined]="true" icon="pi pi-cog" label="Policies" (click)="policiesVisible = true"></button>
      <button pButton icon="pi pi-plus" label="Apply leave" (click)="openApply()"></button>
    </app-page-header>

    <app-hr-agent-rail [keys]="['active.copilot', 'active.engagement']" title="Leave co-pilots" />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Pending" [value]="summary().pending" icon="pi-hourglass" tone="amber" caption="Awaiting approval" />
      <app-kpi-card label="Approved (MTD)" [value]="summary().approvedMtd" icon="pi-check-circle" tone="emerald" caption="This month" />
      <app-kpi-card label="Rejected (MTD)" [value]="summary().rejectedMtd" icon="pi-times-circle" tone="rose" caption="This month" />
      <app-kpi-card label="Balance avg." [value]="summary().balanceAvg" format="1.1-1" caption="days available / employee" icon="pi-calendar" tone="brand" />
    </div>

    <div class="card">
      <p-tabs value="pending">
        <p-tablist>
          <p-tab value="pending">Pending ({{ pending().length }})</p-tab>
          <p-tab value="approved">Approved ({{ approved().length }})</p-tab>
          <p-tab value="rejected">Rejected ({{ rejected().length }})</p-tab>
          <p-tab value="balances">Balances</p-tab>
          <p-tab value="holidays">Holidays</p-tab>
        </p-tablist>
        <p-tabpanels>
          <!-- ===================== PENDING ===================== -->
          <p-tabpanel value="pending">
            <p-table [value]="pending()" responsiveLayout="scroll" [rowHover]="true" [paginator]="pending().length > 12" [rows]="12">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-xs !uppercase !text-surface-500">Employee</th>
                  <th class="!text-xs !uppercase !text-surface-500">Type</th>
                  <th class="!text-xs !uppercase !text-surface-500">Dates</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Days</th>
                  <th class="!text-xs !uppercase !text-surface-500">Applied</th>
                  <th class="!text-xs !uppercase !text-surface-500">Reason</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Actions</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-r>
                <tr>
                  <td>
                    <button type="button" class="flex items-center gap-3 group text-left" (click)="openEmployee(r)" pTooltip="View leave balance">
                      <app-avatar [name]="r.employee" size="sm" />
                      <span class="font-medium group-hover:text-brand-600 group-hover:underline">{{ r.employee }}</span>
                    </button>
                  </td>
                  <td><app-status-pill tone="info">{{ typeLabel(r.type) }}</app-status-pill></td>
                  <td class="whitespace-nowrap text-sm">{{ r.from | date: 'mediumDate' }} – {{ r.to | date: 'mediumDate' }}</td>
                  <td class="text-right tabular-nums">{{ r.days }}</td>
                  <td class="text-sm text-surface-500">{{ r.appliedOn | date: 'mediumDate' }}</td>
                  <td class="text-sm text-surface-600 max-w-[14rem] truncate" [pTooltip]="r.reason">{{ r.reason || '—' }}</td>
                  <td>
                    <div class="flex gap-1.5 justify-end">
                      <button pButton size="small" text rounded icon="pi pi-pencil" pTooltip="Change" class="!text-surface-500" (click)="openEdit(r)"></button>
                      <button pButton size="small" text rounded icon="pi pi-ban" pTooltip="Cancel" class="!text-surface-500" (click)="act(r, 'cancel')"></button>
                      <button pButton size="small" severity="secondary" [outlined]="true" label="Reject" (click)="act(r, 'reject')"></button>
                      <button pButton size="small" label="Approve" (click)="act(r, 'approve')"></button>
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="7" class="text-center text-sm text-surface-500 py-10">No pending leave requests.</td></tr>
              </ng-template>
            </p-table>
          </p-tabpanel>

          <!-- ===================== APPROVED ===================== -->
          <p-tabpanel value="approved">
            <p-table [value]="approved()" responsiveLayout="scroll" [rowHover]="true" [paginator]="approved().length > 12" [rows]="12">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-xs !uppercase !text-surface-500">Employee</th>
                  <th class="!text-xs !uppercase !text-surface-500">Type</th>
                  <th class="!text-xs !uppercase !text-surface-500">Dates</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Days</th>
                  <th class="!text-xs !uppercase !text-surface-500">Approved by</th>
                  <th class="!text-xs !uppercase !text-surface-500">Decided</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Actions</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-r>
                <tr>
                  <td>
                    <button type="button" class="flex items-center gap-3 group text-left" (click)="openEmployee(r)" pTooltip="View leave balance">
                      <app-avatar [name]="r.employee" size="sm" />
                      <span class="font-medium group-hover:text-brand-600 group-hover:underline">{{ r.employee }}</span>
                    </button>
                  </td>
                  <td><app-status-pill tone="info">{{ typeLabel(r.type) }}</app-status-pill></td>
                  <td class="whitespace-nowrap text-sm">{{ r.from | date: 'mediumDate' }} – {{ r.to | date: 'mediumDate' }}</td>
                  <td class="text-right tabular-nums">{{ r.days }}</td>
                  <td class="text-sm">{{ r.decidedBy || r.approver || '—' }}</td>
                  <td class="text-sm text-surface-500">{{ r.decidedAt ? (r.decidedAt | date: 'mediumDate') : '—' }}</td>
                  <td>
                    <div class="flex justify-end">
                      @if (isFuture(r)) {
                        <button pButton size="small" severity="secondary" [outlined]="true" icon="pi pi-ban" label="Cancel" (click)="act(r, 'cancel')"></button>
                      } @else {
                        <span class="text-xs text-surface-400">—</span>
                      }
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="7" class="text-center text-sm text-surface-500 py-10">No approved leave yet.</td></tr>
              </ng-template>
            </p-table>
          </p-tabpanel>

          <!-- ===================== REJECTED ===================== -->
          <p-tabpanel value="rejected">
            <p-table [value]="rejected()" responsiveLayout="scroll" [rowHover]="true" [paginator]="rejected().length > 12" [rows]="12">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-xs !uppercase !text-surface-500">Employee</th>
                  <th class="!text-xs !uppercase !text-surface-500">Type</th>
                  <th class="!text-xs !uppercase !text-surface-500">Dates</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Days</th>
                  <th class="!text-xs !uppercase !text-surface-500">Decided by</th>
                  <th class="!text-xs !uppercase !text-surface-500">Reason</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-r>
                <tr>
                  <td>
                    <button type="button" class="flex items-center gap-3 group text-left" (click)="openEmployee(r)" pTooltip="View leave balance">
                      <app-avatar [name]="r.employee" size="sm" />
                      <span class="font-medium group-hover:text-brand-600 group-hover:underline">{{ r.employee }}</span>
                    </button>
                  </td>
                  <td><app-status-pill tone="info">{{ typeLabel(r.type) }}</app-status-pill></td>
                  <td class="whitespace-nowrap text-sm">{{ r.from | date: 'mediumDate' }} – {{ r.to | date: 'mediumDate' }}</td>
                  <td class="text-right tabular-nums">{{ r.days }}</td>
                  <td class="text-sm">{{ r.decidedBy || '—' }}</td>
                  <td class="text-sm text-surface-600 max-w-[16rem] truncate" [pTooltip]="r.reason">{{ r.reason || '—' }}</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="6" class="text-center text-sm text-surface-500 py-10">No rejected leave.</td></tr>
              </ng-template>
            </p-table>
          </p-tabpanel>

          <!-- ===================== BALANCES ===================== -->
          <p-tabpanel value="balances">
            <p-table [value]="balances()" responsiveLayout="scroll" [rowHover]="true" [paginator]="balances().length > 12" [rows]="12">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-xs !uppercase !text-surface-500">Employee</th>
                  <th class="!text-xs !uppercase !text-surface-500">Department</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Entitled</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Used</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Pending</th>
                  <th class="!text-xs !uppercase !text-surface-500">Available</th>
                  <th class="!w-10"></th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-b>
                <tr class="cursor-pointer" (click)="openBalance(b)">
                  <td>
                    <div class="flex items-center gap-3">
                      <app-avatar [name]="b.name" [image]="b.avatarUrl" size="sm" />
                      <span class="font-medium">{{ b.name }}</span>
                    </div>
                  </td>
                  <td class="text-sm">{{ b.department }}</td>
                  <td class="text-right tabular-nums">{{ b.totalEntitled }}</td>
                  <td class="text-right tabular-nums text-amber-600 dark:text-amber-400">{{ b.totalUsed }}</td>
                  <td class="text-right tabular-nums text-surface-500">{{ b.totalPending }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="w-28 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                        <div class="h-full rounded-full bg-emerald-500" [style.width.%]="(b.totalAvailable / b.totalEntitled) * 100"></div>
                      </div>
                      <span class="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{{ b.totalAvailable }}</span>
                    </div>
                  </td>
                  <td><i class="pi pi-chevron-right text-xs text-surface-400"></i></td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="7" class="text-center text-sm text-surface-500 py-10">No balances.</td></tr>
              </ng-template>
            </p-table>
          </p-tabpanel>

          <!-- ===================== HOLIDAYS ===================== -->
          <p-tabpanel value="holidays">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 p-1">
              <!-- Government / public holidays -->
              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <i class="pi pi-flag text-brand-600"></i>
                  <span class="section-title">Government holidays {{ holidays().year }}</span>
                  <span class="ml-auto text-xs text-surface-500">{{ holidays().publicHolidays.length }} days · paid, company-wide</span>
                </div>
                <ul class="divide-y divide-surface-200 dark:divide-surface-800">
                  @for (h of holidays().publicHolidays; track h.date) {
                    <li class="py-2.5 flex items-center gap-3">
                      <div class="w-12 text-center shrink-0">
                        <div class="text-base font-semibold leading-none">{{ h.date | date: 'd' }}</div>
                        <div class="text-[10px] uppercase text-surface-400">{{ h.date | date: 'MMM' }}</div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">{{ h.name }}</div>
                        <div class="text-[11px] text-surface-500">{{ h.date | date: 'EEEE' }}</div>
                      </div>
                    </li>
                  }
                </ul>
              </div>

              <!-- Optional / restricted holidays -->
              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <i class="pi pi-calendar-plus text-amber-600"></i>
                  <span class="section-title">Optional holidays (RH)</span>
                  <span class="ml-auto text-xs text-surface-500">Choose up to {{ rhEntitlement() }} · {{ rhTaken() }} used</span>
                </div>
                <ul class="divide-y divide-surface-200 dark:divide-surface-800">
                  @for (h of holidays().optionalHolidays; track h.date) {
                    <li class="py-2.5 flex items-center gap-3">
                      <div class="w-12 text-center shrink-0">
                        <div class="text-base font-semibold leading-none">{{ h.date | date: 'd' }}</div>
                        <div class="text-[10px] uppercase text-surface-400">{{ h.date | date: 'MMM' }}</div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">{{ h.name }}</div>
                        <div class="text-[11px] text-surface-500">{{ h.date | date: 'EEEE' }}</div>
                      </div>
                      @if (rhStatus(h); as st) {
                        <app-status-pill [tone]="statusTone(st)">{{ st | titlecase }}</app-status-pill>
                      } @else {
                        <button pButton size="small" [outlined]="true" icon="pi pi-check" label="Apply"
                          [disabled]="rhTaken() >= rhEntitlement()" (click)="applyRh(h)"></button>
                      }
                    </li>
                  }
                </ul>
                <p class="text-[11px] text-surface-400 mt-3"><i class="pi pi-info-circle mr-1"></i>Restricted holidays are applied like leave and need approval.</p>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <!-- ===================== Apply / Change dialog ===================== -->
    <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="editId ? 'Change leave request' : 'Apply for leave'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Employee</label>
          <p-select [options]="employeeOptions()" [(ngModel)]="form.employee" [filter]="true" filterBy="label" placeholder="Select employee" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" [disabled]="!!editId" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Type</label>
          <p-select [options]="typeOptions" [(ngModel)]="form.type" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Days</label>
          <input pInputText [value]="computedDays()" disabled class="w-full mt-1 !rounded-lg" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">From</label>
          <input type="date" [(ngModel)]="form.from" class="w-full mt-1 p-inputtext !rounded-lg" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">To</label>
          <input type="date" [(ngModel)]="form.to" class="w-full mt-1 p-inputtext !rounded-lg" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Reason</label>
          <input pInputText [(ngModel)]="form.reason" class="w-full mt-1 !rounded-lg" placeholder="Brief reason for leave" />
        </div>

        @if (selectedBalance(); as sb) {
          <div class="col-span-2 rounded-lg bg-surface-50 dark:bg-surface-900/40 px-3 py-2 text-xs flex items-center justify-between">
            <span class="text-surface-500">{{ typeLabelFromValue(form.type) }} balance for {{ form.employee }}</span>
            <span class="font-medium" [class.text-rose-600]="computedDays() > sb.available" [class.text-emerald-600]="computedDays() <= sb.available">
              {{ sb.available }} available · {{ sb.used }} used of {{ sb.entitled }}
            </span>
          </div>
          @if (computedDays() > sb.available) {
            <div class="col-span-2 text-[11px] text-rose-600 -mt-2"><i class="pi pi-exclamation-triangle mr-1"></i>Requested days exceed the available balance.</div>
          }
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" [outlined]="true" label="Cancel" (click)="dialogVisible = false"></button>
        <button pButton [label]="editId ? 'Save changes' : 'Submit request'" [disabled]="!canSubmit()" (click)="submit()"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Balance detail dialog ===================== -->
    <p-dialog [(visible)]="balanceVisible" [modal]="true" [style]="{ width: '40rem' }" [header]="(selectedEmp()?.name || '') + ' · Leave balance'" [draggable]="false" [dismissableMask]="true">
      @if (selectedEmp(); as b) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center gap-3">
            <app-avatar [name]="b.name" [image]="b.avatarUrl" size="lg" />
            <div>
              <div class="font-semibold">{{ b.name }}</div>
              <div class="text-xs text-surface-500">{{ b.designation }} · {{ b.department }}</div>
            </div>
            <div class="ml-auto text-right">
              <div class="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{ b.totalAvailable }}</div>
              <div class="text-[11px] text-surface-500">days available
                @if (b.totalCarriedForward) { <span class="text-brand-600">(incl. {{ b.totalCarriedForward }} carried)</span> }
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            @for (t of b.byType; track t.type) {
              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-sm font-medium">{{ t.type }}</span>
                  <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{{ t.available }} left</span>
                </div>
                <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                  <div class="h-full rounded-full bg-brand-500" [style.width.%]="(t.used / (t.entitled + t.carriedForward || 1)) * 100"></div>
                </div>
                <!-- Balance log: opening (carried) + accrued − used − pending -->
                <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-surface-500 mt-2">
                  <span>Carried fwd</span><span class="text-right tabular-nums" [class.text-brand-600]="t.carriedForward">+{{ t.carriedForward }}</span>
                  <span>Accrued (yr)</span><span class="text-right tabular-nums">+{{ t.entitled }}</span>
                  <span>Used</span><span class="text-right tabular-nums text-amber-600">−{{ t.used }}</span>
                  <span>Pending</span><span class="text-right tabular-nums">−{{ t.pending }}</span>
                </div>
              </div>
            }
          </div>

          <div>
            <div class="section-title mb-2">Recent requests</div>
            @if (empHistory(); as hist) {
              <p-table [value]="hist" responsiveLayout="scroll" styleClass="!border-0 text-sm">
                <ng-template pTemplate="header">
                  <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                    <th class="!text-xs !uppercase !text-surface-500">Dates</th>
                    <th class="!text-xs !uppercase !text-surface-500">Type</th>
                    <th class="!text-xs !uppercase !text-surface-500 !text-right">Days</th>
                    <th class="!text-xs !uppercase !text-surface-500">Status</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-h>
                  <tr>
                    <td class="whitespace-nowrap">{{ h.from | date: 'MMM d' }} – {{ h.to | date: 'MMM d, y' }}</td>
                    <td>{{ typeLabel(h.type) }}</td>
                    <td class="text-right tabular-nums">{{ h.days }}</td>
                    <td><app-status-pill [tone]="statusTone(h.status)">{{ h.status | titlecase }}</app-status-pill></td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="4" class="py-6 text-center text-surface-500">No leave history this year.</td></tr>
                </ng-template>
              </p-table>
            } @else {
              <div class="py-6 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner"></i></div>
            }
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton label="Close" (click)="balanceVisible = false"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Policies dialog ===================== -->
    <p-dialog [(visible)]="policiesVisible" [modal]="true" [style]="{ width: '32rem' }" header="Leave policy" [draggable]="false" [dismissableMask]="true">
      <p class="text-xs text-surface-500 mb-3">Annual entitlement per employee (working days). Balances and validation use these figures.</p>
      <div class="space-y-2">
        @for (p of policy(); track p.type) {
          <div class="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-800 px-3 py-2">
            <span class="text-sm font-medium">{{ p.type }}</span>
            <span class="text-sm tabular-nums">{{ p.entitled }} days / year</span>
          </div>
        }
      </div>
      <ng-template pTemplate="footer"><button pButton label="Close" (click)="policiesVisible = false"></button></ng-template>
    </p-dialog>
  `
})
export class LeaveComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly employees = inject(EmployeeService);
  private readonly hrAccess = inject(HrAccessService);
  private readonly base = `${environment.apiBaseUrl}/hr/leave`;

  protected readonly pending = signal<LeaveRow[]>([]);
  protected readonly approved = signal<LeaveRow[]>([]);
  protected readonly rejected = signal<LeaveRow[]>([]);
  protected readonly balances = signal<EmployeeBalance[]>([]);
  protected readonly summary = signal<LeaveSummary>({ pending: 0, approvedMtd: 0, rejectedMtd: 0, onLeaveToday: 0, balanceAvg: 0 });
  protected readonly holidays = signal<HolidaysResponse>({ year: new Date().getFullYear(), publicHolidays: [], optionalHolidays: [] });

  protected readonly employeeOptions = computed(() =>
    this.employees.all().map((e) => ({ label: e.fullName, value: e.fullName }))
  );

  // Leave policy shown in the Policies dialog — derived from the live balance types when available.
  protected readonly policy = computed(() => {
    const types = this.balances()[0]?.byType;
    if (types?.length) return types.map((t) => ({ type: t.type, entitled: t.entitled }));
    return [
      { type: 'Casual', entitled: 12 }, { type: 'Sick', entitled: 12 }, { type: 'Earned', entitled: 18 },
      { type: 'Paid leave', entitled: 12 }, { type: 'Comp-off', entitled: 6 }, { type: 'Special leave', entitled: 5 },
      { type: 'Blocked leave', entitled: 3 }, { type: 'Restricted Holiday', entitled: 2 }
    ];
  });

  readonly typeOptions = [
    { label: 'Casual', value: 'Casual' },
    { label: 'Sick', value: 'Sick' },
    { label: 'Earned', value: 'Earned' },
    { label: 'Paid leave', value: 'Paid' },
    { label: 'Comp-off', value: 'CompOff' },
    { label: 'Special leave', value: 'Special' },
    { label: 'Blocked leave', value: 'Blocked' },
    { label: 'Unpaid', value: 'Unpaid' }
  ];

  dialogVisible = false;
  editId: string | null = null;
  form = this.blank();

  policiesVisible = false;

  balanceVisible = false;
  protected readonly selectedEmp = signal<EmployeeBalance | null>(null);
  protected readonly empHistory = signal<LeaveRow[] | null>(null);

  constructor() {
    this.reload();
  }

  // ---- loading ----
  reload() {
    forkJoin({
      pending: this.http.get<LeaveRow[]>(this.base, { params: { status: 'Pending' } }),
      approved: this.http.get<LeaveRow[]>(this.base, { params: { status: 'Approved' } }),
      rejected: this.http.get<LeaveRow[]>(this.base, { params: { status: 'Rejected' } }),
      balances: this.http.get<EmployeeBalance[]>(`${this.base}/balances`),
      summary: this.http.get<LeaveSummary>(`${this.base}/summary`),
      holidays: this.http.get<HolidaysResponse>(`${this.base}/holidays`, { params: { year: new Date().getFullYear() } })
    }).subscribe((r) => {
      this.pending.set(r.pending);
      this.approved.set(r.approved);
      this.rejected.set(r.rejected);
      this.balances.set(r.balances);
      this.summary.set(r.summary);
      this.holidays.set(r.holidays);
    });
  }

  // ---- Optional / restricted holidays ----
  private myName(): string { return this.hrAccess.access()?.name ?? this.employees.all()[0]?.fullName ?? ''; }

  /** All of the current user's RH requests (any tab), keyed by date. */
  private myRhRequests(): LeaveRow[] {
    const me = this.myName();
    return [...this.pending(), ...this.approved(), ...this.rejected()]
      .filter((r) => r.type === 'RestrictedHoliday' && r.employee === me);
  }
  rhStatus(h: Holiday): string | null {
    return this.myRhRequests().find((r) => r.from.slice(0, 10) === h.date)?.status ?? null;
  }
  rhEntitlement(): number {
    const mine = this.balances().find((b) => b.name === this.myName());
    return mine?.byType.find((t) => t.type === 'Restricted Holiday')?.entitled ?? 2;
  }
  rhTaken(): number {
    return this.myRhRequests().filter((r) => r.status === 'pending' || r.status === 'approved').length;
  }

  applyRh(h: Holiday) {
    const body = { employee: this.myName(), type: 'RestrictedHoliday', from: h.date, to: h.date, days: 1, reason: `Optional holiday: ${h.name}` };
    this.http.post(this.base, body).subscribe({
      next: () => { this.messages.add({ severity: 'success', summary: 'Optional holiday requested', detail: `${h.name} · ${h.date}` }); this.reload(); },
      error: (e) => this.messages.add({ severity: 'error', summary: 'Could not apply', detail: e?.error?.message ?? 'Please try again.' })
    });
  }

  // ---- actions ----
  act(r: LeaveRow, action: 'approve' | 'reject' | 'cancel') {
    this.http.post(`${this.base}/${r.id}/${action}`, {}).subscribe({
      next: () => {
        const verb = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Cancelled';
        this.messages.add({ severity: action === 'approve' ? 'success' : 'warn', summary: verb, detail: r.employee });
        this.reload();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Action failed', detail: 'Could not update the request.' })
    });
  }

  openApply() {
    this.editId = null;
    this.form = this.blank();
    this.dialogVisible = true;
  }

  openEdit(r: LeaveRow) {
    this.editId = r.id;
    this.form = {
      employee: r.employee,
      type: this.normalizeType(r.type),
      from: r.from.slice(0, 10),
      to: r.to.slice(0, 10),
      reason: r.reason ?? ''
    };
    this.dialogVisible = true;
  }

  submit() {
    const days = this.computedDays();
    const to = this.form.to && this.form.to >= this.form.from ? this.form.to : this.form.from;
    if (this.editId) {
      const body = { type: this.form.type, from: this.form.from, to, days, reason: this.form.reason.trim() };
      this.http.put(`${this.base}/${this.editId}`, body).subscribe({
        next: () => {
          this.messages.add({ severity: 'success', summary: 'Request updated', detail: `${this.form.employee} · ${days} day(s)` });
          this.dialogVisible = false;
          this.reload();
        },
        error: () => this.messages.add({ severity: 'error', summary: 'Update failed', detail: 'Could not change the request.' })
      });
    } else {
      const body = { employee: this.form.employee.trim(), type: this.form.type, from: this.form.from, to, days, reason: this.form.reason.trim() };
      this.http.post(this.base, body).subscribe({
        next: () => {
          this.messages.add({ severity: 'success', summary: 'Leave requested', detail: `${body.employee} · ${days} day(s)` });
          this.dialogVisible = false;
          this.reload();
        },
        error: () => this.messages.add({ severity: 'error', summary: 'Apply failed', detail: 'Could not submit the request.' })
      });
    }
  }

  openBalance(b: EmployeeBalance) {
    this.selectedEmp.set(b);
    this.empHistory.set(null);
    this.balanceVisible = true;
    const params = new HttpParams().set('employee', b.name);
    this.http.get<LeaveRow[]>(this.base, { params }).subscribe((h) => this.empHistory.set(h));
  }

  openEmployee(r: LeaveRow) {
    const b = this.balances().find((x) => (r.employeeId && x.employeeId === r.employeeId) || x.name === r.employee);
    if (b) this.openBalance(b);
    else this.messages.add({ severity: 'info', summary: 'No balance', detail: `No balance record for ${r.employee}.` });
  }

  // ---- helpers ----
  computedDays(): number {
    const { from, to } = this.form;
    if (!from) return 1;
    const end = to && to >= from ? to : from;
    return Math.max(1, Math.round((Date.parse(end) - Date.parse(from)) / 86_400_000) + 1);
  }

  canSubmit(): boolean {
    return !!(this.form.employee?.trim() && this.form.from);
  }

  selectedBalance(): TypeBalance | null {
    const emp = this.balances().find((b) => b.name === this.form.employee);
    if (!emp) return null;
    const label = this.typeLabelFromValue(this.form.type);
    return emp.byType.find((t) => t.type === label) ?? null;
  }

  isFuture(r: LeaveRow): boolean {
    return new Date(r.to) >= new Date(new Date().toDateString());
  }

  typeLabel(t: string): string {
    return {
      CompOff: 'Comp-off', Paid: 'Paid leave', Special: 'Special leave',
      Blocked: 'Blocked leave', RestrictedHoliday: 'Restricted Holiday'
    }[t] ?? t;
  }
  typeLabelFromValue(v: string): string {
    return this.typeOptions.find((o) => o.value === v)?.label ?? v;
  }
  private normalizeType(t: string): string {
    return this.typeOptions.find((o) => o.value === t || o.label === this.typeLabel(t))?.value ?? 'Casual';
  }

  statusTone(s: string): StatusTone {
    return { approved: 'success', pending: 'warn', rejected: 'danger', cancelled: 'neutral' }[s] as StatusTone ?? 'neutral';
  }

  private blank() {
    const today = new Date().toISOString().slice(0, 10);
    const first = this.employees.all()[0]?.fullName ?? '';
    return { employee: first, type: 'Casual', from: today, to: today, reason: '' };
  }
}
