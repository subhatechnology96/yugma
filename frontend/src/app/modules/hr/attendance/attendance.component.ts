import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '@env/environment';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { HrAccessService } from '@core/services/hr-access.service';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';

type AttStatus = 'present' | 'wfh' | 'late' | 'leave' | 'absent' | 'weekoff' | 'upcoming';

interface MonthDay {
  date: string;
  day: number;
  weekday: number;
  isWeekend: boolean;
  status: AttStatus;
  inTime: string | null;
  outTime: string | null;
  hours: number;
  lateByMin: number;
  overtimeMin: number;
  location: string;
  isManual: boolean;
}

interface MonthSummary {
  present: number;
  wfh: number;
  late: number;
  onLeave: number;
  absent: number;
  weekOff: number;
  workingDays: number;
  worked: number;
  attendanceRatePct: number;
  onTimePct: number;
  totalHours: number;
  avgHours: number;
  overtimeHours: number;
}

interface EmployeeRef {
  employeeId: string;
  name: string;
  code: string;
  department: string;
  designation: string;
  avatarUrl?: string;
}

type CorrectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface Correction {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  requestedStatus: AttStatus;
  requestedInTime: string | null;
  requestedOutTime: string | null;
  reason: string;
  status: CorrectionStatus;
  approver: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

interface AttendanceMonth {
  year: number;
  month: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  avatarUrl?: string;
  summary: MonthSummary;
  days: MonthDay[];
  selectableEmployees: EmployeeRef[];
  corrections: Correction[];
}

interface AttendanceConfig {
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  fullDayHours: number;
  overtimeThresholdHours: number;
  weekendDays: number[];
}

interface CellTone {
  wrap: string;
  dot: string;
  text: string;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    MultiSelectModule,
    DialogModule,
    TooltipModule,
    PageHeaderComponent,
    KpiCardComponent,
    StatusPillComponent,
    AvatarComponent,
    HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Time" title="Attendance" subtitle="Your month at a glance — punches, late arrivals, work-from-home, leave and absences.">
      <button pButton severity="secondary" outlined icon="pi pi-cog" label="Configure" (click)="openConfig()"></button>
      <button pButton severity="secondary" outlined icon="pi pi-download" label="Export" (click)="exportCsv()"></button>
    </app-page-header>

    <app-hr-agent-rail [keys]="['active.attendance', 'active.copilot']" title="Attendance co-pilots" />

    @if (data(); as d) {
      <!-- Employee banner + month KPIs -->
      <div class="card p-4 mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-center gap-3">
          <app-avatar [name]="d.employeeName" [image]="d.avatarUrl" size="lg" />
          <div>
            <div class="text-base font-semibold">{{ d.employeeName }}</div>
            <div class="text-xs text-surface-500">{{ d.employeeCode }} · {{ d.designation }} · {{ d.department }}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5">
            <div class="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Attendance</div>
            <div class="text-xl font-semibold text-emerald-700 dark:text-emerald-300">{{ d.summary.attendanceRatePct }}%</div>
          </div>
          <div class="rounded-xl bg-surface-50 dark:bg-surface-900/40 px-4 py-2.5">
            <div class="text-[11px] font-medium text-surface-500">On-time</div>
            <div class="text-xl font-semibold">{{ d.summary.onTimePct }}%</div>
          </div>
          <div class="rounded-xl bg-surface-50 dark:bg-surface-900/40 px-4 py-2.5">
            <div class="text-[11px] font-medium text-surface-500">Avg / day</div>
            <div class="text-xl font-semibold">{{ d.summary.avgHours }}h</div>
          </div>
          <div class="rounded-xl bg-surface-50 dark:bg-surface-900/40 px-4 py-2.5">
            <div class="text-[11px] font-medium text-surface-500">Overtime</div>
            <div class="text-xl font-semibold">{{ d.summary.overtimeHours }}h</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <app-kpi-card label="Present" [value]="d.summary.present" icon="pi-check" tone="emerald" caption="days this month" />
        <app-kpi-card label="WFH" [value]="d.summary.wfh" icon="pi-home" tone="indigo" caption="days remote" />
        <app-kpi-card label="Late" [value]="d.summary.late" icon="pi-clock" tone="amber" caption="late arrivals" />
        <app-kpi-card label="Leave" [value]="d.summary.onLeave" icon="pi-calendar" tone="brand" caption="days on leave" />
        <app-kpi-card label="Absent" [value]="d.summary.absent" icon="pi-times" tone="rose" caption="days absent" />
      </div>

      <!-- Manager approvals: pending time corrections from the team -->
      @if (teamCorrections().length > 0) {
        <div class="card p-4 mb-4 border-amber-200/70 dark:border-amber-500/30">
          <div class="flex items-center gap-2 mb-3">
            <i class="pi pi-hourglass text-amber-500"></i>
            <div class="section-title">Time corrections awaiting your approval</div>
            <span class="rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2 py-0.5">{{ teamCorrections().length }}</span>
          </div>
          <div class="space-y-2">
            @for (c of teamCorrections(); track c.id) {
              <div class="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 dark:border-surface-800 p-3">
                <app-avatar [name]="c.employeeName" size="sm" />
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium">{{ c.employeeName }} · {{ c.date | date: 'd MMM y' }}</div>
                  <div class="text-xs text-surface-500">
                    Requested {{ label(c.requestedStatus) }}@if (c.requestedInTime) { <span> · {{ c.requestedInTime }}–{{ c.requestedOutTime }}</span> } — “{{ c.reason }}”
                  </div>
                </div>
                <div class="flex gap-2">
                  <button pButton size="small" severity="success" icon="pi pi-check" label="Approve" (click)="approveCorrection(c)"></button>
                  <button pButton size="small" severity="danger" outlined icon="pi pi-times" label="Reject" (click)="rejectCorrection(c)"></button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Calendar -->
      <div class="card overflow-hidden">
        <!-- Toolbar -->
        <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1">
            <button pButton text rounded icon="pi pi-chevron-left" (click)="shiftMonth(-1)" pTooltip="Previous month" class="!text-surface-500"></button>
            <div class="min-w-[10.5rem] text-center text-lg font-semibold">{{ monthNames[viewMonth - 1] }} {{ viewYear }}</div>
            <button pButton text rounded icon="pi pi-chevron-right" (click)="shiftMonth(1)" pTooltip="Next month" class="!text-surface-500"></button>
          </div>

          <p-select [options]="monthOptions" [(ngModel)]="viewMonth" (onChange)="load()" optionLabel="label" optionValue="value" styleClass="!rounded-lg" />
          <p-select [options]="yearOptions" [(ngModel)]="viewYear" (onChange)="load()" styleClass="!rounded-lg" />

          @if (d.selectableEmployees.length > 1) {
            <p-select
              [options]="employeeOptions()"
              [(ngModel)]="selectedEmployeeId"
              (onChange)="load()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              filterBy="label"
              placeholder="Select employee"
              styleClass="!rounded-lg min-w-[15rem]" />
          }

          <button pButton severity="secondary" outlined size="small" icon="pi pi-calendar-clock" label="Today" (click)="goToday()" class="ml-auto"></button>
        </div>

        <!-- Legend -->
        <div class="px-4 py-2.5 border-b border-surface-200 dark:border-surface-800 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-surface-500">
          @for (l of legend; track l.status) {
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" [class]="tones[l.status].dot"></span>{{ l.label }}</span>
          }
        </div>

        <!-- Weekday header -->
        <div class="grid grid-cols-7 border-b border-surface-200 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900/30">
          @for (w of weekdayLabels; track w) {
            <div class="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-surface-400">{{ w }}</div>
          }
        </div>

        <!-- Weeks -->
        <div class="p-2 sm:p-3 space-y-2">
          @for (week of weeks(); track $index) {
            <div class="grid grid-cols-7 gap-2">
              @for (cell of week; track $index) {
                @if (cell) {
                  <button
                    type="button"
                    (click)="selectDay(cell)"
                    [disabled]="cell.status === 'upcoming'"
                    class="relative text-left rounded-xl border p-2 min-h-[78px] sm:min-h-[92px] flex flex-col transition focus:outline-none focus:ring-2 focus:ring-brand-300"
                    [class]="cellClass(cell)">
                    <div class="flex items-start justify-between">
                      <span class="text-sm font-semibold leading-none" [class]="isToday(cell) ? 'grid place-items-center w-6 h-6 rounded-full bg-brand-600 text-white' : tones[cell.status].text">{{ cell.day }}</span>
                      <span class="flex items-center gap-1">
                        @if (pendingCorrection(cell.date)) {
                          <i class="pi pi-hourglass text-[9px] text-amber-500" pTooltip="Correction pending approval"></i>
                        }
                        @if (cell.isManual) {
                          <i class="pi pi-pencil text-[9px] text-brand-500" pTooltip="Manually edited"></i>
                        }
                      </span>
                    </div>

                    @if (cell.status === 'upcoming') {
                      <span class="mt-auto text-[10px] text-surface-300 dark:text-surface-600">—</span>
                    } @else if (cell.status === 'weekoff') {
                      <span class="mt-auto text-[10px] font-medium text-surface-400">Week off</span>
                    } @else {
                      <div class="mt-auto">
                        <div class="inline-flex items-center gap-1 text-[10px] font-semibold" [class]="tones[cell.status].text">
                          <span class="w-1.5 h-1.5 rounded-full" [class]="tones[cell.status].dot"></span>{{ shortLabel(cell.status) }}
                        </div>
                        @if (cell.hours > 0) {
                          <div class="text-[10px] text-surface-500 tabular-nums mt-0.5">
                            {{ cell.hours | number: '1.1-1' }}h
                            @if (cell.overtimeMin > 0) { <span class="text-emerald-600 dark:text-emerald-400">· OT</span> }
                            @if (cell.lateByMin > 0) { <span class="text-amber-600 dark:text-amber-400">· +{{ cell.lateByMin }}m</span> }
                          </div>
                        }
                      </div>
                    }
                  </button>
                } @else {
                  <div class="rounded-xl min-h-[78px] sm:min-h-[92px]"></div>
                }
              }
            </div>
          }
        </div>
      </div>

      <!-- Selected day detail -->
      @if (selectedDay(); as s) {
        <div class="card p-5 mt-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-xs uppercase tracking-wide text-surface-400">{{ s.date | date: 'EEEE' }}</div>
              <div class="text-lg font-semibold">{{ s.date | date: 'fullDate' }}</div>
            </div>
            <app-status-pill [tone]="tone(s.status)">{{ label(s.status) }}</app-status-pill>
          </div>

          @if (s.status === 'upcoming') {
            <p class="mt-3 text-sm text-surface-500">This day hasn't happened yet.</p>
          } @else {
            <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div class="text-[11px] text-surface-500">Check-in</div>
                <div class="font-semibold tabular-nums">{{ s.inTime ?? '—' }}
                  @if (s.lateByMin > 0) { <span class="ml-1 text-[11px] text-amber-600 dark:text-amber-400">+{{ s.lateByMin }}m</span> }
                </div>
              </div>
              <div>
                <div class="text-[11px] text-surface-500">Check-out</div>
                <div class="font-semibold tabular-nums">{{ s.outTime ?? '—' }}</div>
              </div>
              <div>
                <div class="text-[11px] text-surface-500">Hours</div>
                <div class="font-semibold tabular-nums">{{ s.hours ? (s.hours | number: '1.1-1') + 'h' : '—' }}
                  @if (s.overtimeMin > 0) { <span class="ml-1 text-[11px] text-emerald-600 dark:text-emerald-400">OT {{ s.overtimeMin }}m</span> }
                </div>
              </div>
              <div>
                <div class="text-[11px] text-surface-500">Location</div>
                <div class="font-semibold">{{ s.location }}</div>
              </div>
            </div>

            <div class="mt-4 border-t border-surface-100 dark:border-surface-800 pt-4">
              @if (pendingCorrection(s.date); as pc) {
                <div class="flex flex-wrap items-center gap-3">
                  <span class="inline-flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    <i class="pi pi-hourglass"></i> Correction pending approval @if (pc.approver) { <span class="font-normal text-surface-500">· with {{ pc.approver }}</span> }
                  </span>
                  @if (isSelf()) {
                    <button pButton size="small" severity="secondary" outlined icon="pi pi-times" label="Withdraw" (click)="cancelCorrection(pc)"></button>
                  } @else if (canEdit()) {
                    <button pButton size="small" severity="success" icon="pi pi-check" label="Approve" (click)="approveCorrection(pc)"></button>
                    <button pButton size="small" severity="danger" outlined icon="pi pi-times" label="Reject" (click)="rejectCorrection(pc)"></button>
                  }
                </div>
                <p class="mt-2 text-xs text-surface-500">Requested {{ label(pc.requestedStatus) }}@if (pc.requestedInTime) { <span> · {{ pc.requestedInTime }}–{{ pc.requestedOutTime }}</span> } — “{{ pc.reason }}”</p>
              } @else if (isSelf()) {
                <button pButton size="small" icon="pi pi-clock" label="Request correction" (click)="openRequest(s)"></button>
                <p class="mt-2 text-xs text-surface-500">A correction is sent to your reporting manager for approval before it applies.</p>
              } @else if (canEdit()) {
                <div class="flex gap-2">
                  <button pButton size="small" icon="pi pi-pencil" label="Edit timing" (click)="openEdit(s)"></button>
                  @if (s.isManual) {
                    <button pButton size="small" severity="secondary" outlined icon="pi pi-undo" label="Reset to system" (click)="resetEntry(s)"></button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    } @else {
      <div class="card p-10 grid place-items-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl"></i></div>
    }

    <!-- Attendance policy configuration -->
    <p-dialog header="Attendance configuration" [(visible)]="configVisible" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <p class="text-xs text-surface-500">These settings define your attendance policy and immediately drive the calendar's punches, late flags, overtime and week-offs.</p>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Shift start</label>
            <input pInputText [(ngModel)]="draft.shiftStart" placeholder="09:00" class="w-full !rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Shift end</label>
            <input pInputText [(ngModel)]="draft.shiftEnd" placeholder="18:00" class="w-full !rounded-lg" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Late grace</label>
            <p-inputNumber [(ngModel)]="draft.graceMinutes" [min]="0" [max]="120" suffix=" min" styleClass="w-full" inputStyleClass="!rounded-lg w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Full day</label>
            <p-inputNumber [(ngModel)]="draft.fullDayHours" [min]="1" [max]="16" [minFractionDigits]="0" [maxFractionDigits]="1" suffix=" h" styleClass="w-full" inputStyleClass="!rounded-lg w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">OT after</label>
            <p-inputNumber [(ngModel)]="draft.overtimeThresholdHours" [min]="1" [max]="16" [minFractionDigits]="0" [maxFractionDigits]="1" suffix=" h" styleClass="w-full" inputStyleClass="!rounded-lg w-full" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Weekly off days</label>
          <p-multiSelect [options]="dayOptions" [(ngModel)]="draft.weekendDays" optionLabel="label" optionValue="value" display="chip" placeholder="Select week-off days" styleClass="w-full !rounded-lg" />
        </div>
      </div>

      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Reset to defaults" icon="pi pi-refresh" (click)="resetConfig()"></button>
        <button pButton severity="secondary" outlined label="Cancel" (click)="configVisible = false"></button>
        <button pButton label="Save & apply" icon="pi pi-check" (click)="saveConfig()"></button>
      </ng-template>
    </p-dialog>

    <!-- Edit a punch for the day -->
    <p-dialog [header]="'Edit attendance · ' + editName" [(visible)]="editVisible" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <p class="text-xs text-surface-500">{{ editDateIso | date: 'fullDate' }}</p>

        <div>
          <label class="block text-sm font-medium mb-1">Status</label>
          <p-select [options]="statusOptions" [(ngModel)]="editEntry.status" optionLabel="label" optionValue="value" styleClass="w-full !rounded-lg" />
        </div>

        @if (editEntry.status !== 'leave' && editEntry.status !== 'absent') {
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">In time</label>
              <input pInputText [(ngModel)]="editEntry.inTime" placeholder="09:00" class="w-full !rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Out time</label>
              <input pInputText [(ngModel)]="editEntry.outTime" placeholder="18:00" class="w-full !rounded-lg" />
            </div>
          </div>
          <p class="text-[11px] text-surface-500">Use 24-hour HH:mm. Hours, late-by and overtime are recalculated against the current policy.</p>
        } @else {
          <p class="text-[11px] text-surface-500">No punch times are recorded for leave / absent.</p>
        }
      </div>

      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="editVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="saveEntry()"></button>
      </ng-template>
    </p-dialog>

    <!-- Request a time correction (self-service → manager approval) -->
    <p-dialog header="Request time correction" [(visible)]="requestVisible" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <p class="text-xs text-surface-500">{{ requestDateIso | date: 'fullDate' }} — this will be sent to your reporting manager for approval.</p>

        <div>
          <label class="block text-sm font-medium mb-1">Corrected status</label>
          <p-select [options]="statusOptions" [(ngModel)]="requestEntry.status" optionLabel="label" optionValue="value" styleClass="w-full !rounded-lg" />
        </div>

        @if (requestEntry.status !== 'leave' && requestEntry.status !== 'absent') {
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">In time</label>
              <input pInputText [(ngModel)]="requestEntry.inTime" placeholder="09:00" class="w-full !rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Out time</label>
              <input pInputText [(ngModel)]="requestEntry.outTime" placeholder="18:00" class="w-full !rounded-lg" />
            </div>
          </div>
        }

        <div>
          <label class="block text-sm font-medium mb-1">Reason <span class="text-rose-500">*</span></label>
          <textarea
            [(ngModel)]="requestEntry.reason"
            rows="3"
            placeholder="e.g. Forgot to punch out after a client call."
            class="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"></textarea>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="requestVisible = false"></button>
        <button pButton label="Submit for approval" icon="pi pi-send" (click)="submitRequest()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class AttendanceComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly hrAccess = inject(HrAccessService);
  private readonly base = `${environment.apiBaseUrl}/my-work/attendance`;

  private readonly now = new Date();
  protected viewYear = this.now.getFullYear();
  protected viewMonth = this.now.getMonth() + 1; // 1..12
  protected selectedEmployeeId: string | null = null;

  protected readonly data = signal<AttendanceMonth | null>(null);
  protected readonly selectedDay = signal<MonthDay | null>(null);
  protected readonly teamCorrections = signal<Correction[]>([]);

  /** Whether the displayed calendar is the signed-in user's own. */
  protected readonly isSelf = computed(() => {
    const d = this.data();
    return !!d && d.employeeId === this.hrAccess.access()?.employeeId;
  });

  /** Latest correction per day for the displayed employee (corrections arrive newest-first). */
  protected readonly correctionByDate = computed(() => {
    const map = new Map<string, Correction>();
    for (const c of this.data()?.corrections ?? []) if (!map.has(c.date)) map.set(c.date, c);
    return map;
  });

  protected readonly monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  protected readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  protected readonly monthOptions = this.monthNames.map((label, i) => ({ label, value: i + 1 }));
  protected readonly yearOptions = Array.from({ length: 5 }, (_, i) => this.now.getFullYear() - 3 + i);

  protected readonly legend: { status: AttStatus; label: string }[] = [
    { status: 'present', label: 'Present' },
    { status: 'wfh', label: 'WFH' },
    { status: 'late', label: 'Late' },
    { status: 'leave', label: 'Leave' },
    { status: 'absent', label: 'Absent' },
    { status: 'weekoff', label: 'Week off' }
  ];

  protected readonly tones: Record<AttStatus, CellTone> = {
    present: { wrap: 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/30 hover:border-emerald-300', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    wfh: { wrap: 'bg-brand-50/70 dark:bg-brand-500/10 border-brand-200/70 dark:border-brand-500/30 hover:border-brand-300', dot: 'bg-brand-500', text: 'text-brand-700 dark:text-brand-300' },
    late: { wrap: 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/30 hover:border-amber-300', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    leave: { wrap: 'bg-violet-50/70 dark:bg-violet-500/10 border-violet-200/70 dark:border-violet-500/30 hover:border-violet-300', dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300' },
    absent: { wrap: 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200/70 dark:border-rose-500/30 hover:border-rose-300', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
    weekoff: { wrap: 'bg-surface-50 dark:bg-surface-900/40 border-dashed border-surface-200 dark:border-surface-800', dot: 'bg-surface-300', text: 'text-surface-400' },
    upcoming: { wrap: 'bg-white dark:bg-surface-900 border-surface-100 dark:border-surface-800 cursor-default', dot: '', text: 'text-surface-300 dark:text-surface-600' }
  };

  // ---- attendance policy configuration ----
  private static readonly CONFIG_KEY = 'yugma.attendance.config';
  private static readonly DEFAULT_CONFIG: AttendanceConfig = {
    shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, fullDayHours: 9, overtimeThresholdHours: 9, weekendDays: [0, 6]
  };
  protected readonly dayOptions = [
    { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }
  ];
  protected readonly config = signal<AttendanceConfig>(this.loadConfig());
  protected configVisible = false;
  protected draft: AttendanceConfig = { ...this.config(), weekendDays: [...this.config().weekendDays] };

  // ---- per-day edit ----
  protected readonly statusOptions = [
    { label: 'Present', value: 'present' },
    { label: 'Work from home', value: 'wfh' },
    { label: 'Late', value: 'late' },
    { label: 'On leave', value: 'leave' },
    { label: 'Absent', value: 'absent' }
  ];
  protected editVisible = false;
  protected editName = '';
  protected editDateIso = '';
  protected editEntry: { status: AttStatus; inTime: string; outTime: string } = { status: 'present', inTime: '', outTime: '' };

  // ---- self-service correction request (manager-approved) ----
  protected requestVisible = false;
  protected requestDateIso = '';
  protected requestEntry: { status: AttStatus; inTime: string; outTime: string; reason: string } = { status: 'present', inTime: '', outTime: '', reason: '' };

  protected readonly employeeOptions = computed(() =>
    (this.data()?.selectableEmployees ?? []).map((e) => ({ label: `${e.name} · ${e.code}`, value: e.employeeId }))
  );

  /** Calendar weeks: leading blanks for the first weekday, then days, padded to full weeks. */
  protected readonly weeks = computed<(MonthDay | null)[][]>(() => {
    const d = this.data();
    if (!d || d.days.length === 0) return [];
    const lead = d.days[0].weekday; // 0 = Sunday
    const cells: (MonthDay | null)[] = [...Array<null>(lead).fill(null), ...d.days];
    while (cells.length % 7 !== 0) cells.push(null);
    const out: (MonthDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  });

  constructor() {
    this.load();
  }

  load() {
    const c = this.config();
    let params = new HttpParams()
      .set('year', String(this.viewYear))
      .set('month', String(this.viewMonth))
      .set('shiftStart', c.shiftStart)
      .set('shiftEnd', c.shiftEnd)
      .set('graceMinutes', String(c.graceMinutes))
      .set('fullDayHours', String(c.fullDayHours))
      .set('overtimeThresholdHours', String(c.overtimeThresholdHours))
      .set('weekendDays', c.weekendDays.join(','));
    if (this.selectedEmployeeId) params = params.set('employeeId', this.selectedEmployeeId);
    this.http.get<AttendanceMonth>(`${this.base}/month`, { params }).subscribe((d) => {
      this.data.set(d);
      // keep selectedEmployeeId in sync with what the server resolved (so the picker reflects self)
      this.selectedEmployeeId = d.employeeId;
      // refresh the open day-detail to the same date in the new month, else clear it
      const cur = this.selectedDay();
      this.selectedDay.set(cur ? d.days.find((x) => x.date === cur.date) ?? null : null);
    });
    if (this.hrAccess.canManageTeam()) this.loadTeamCorrections();
  }

  private loadTeamCorrections() {
    this.http
      .get<Correction[]>(`${this.base}/corrections`, { params: new HttpParams().set('scope', 'team').set('status', 'pending') })
      .subscribe((rows) => this.teamCorrections.set(rows));
  }

  // ---- self-service correction request ----
  pendingCorrection(dateIso: string): Correction | undefined {
    const c = this.correctionByDate().get(dateIso);
    return c?.status === 'pending' ? c : undefined;
  }

  openRequest(d: MonthDay) {
    this.requestDateIso = d.date;
    this.requestEntry = {
      status: d.status === 'weekoff' || d.status === 'upcoming' ? 'present' : d.status,
      inTime: d.inTime ?? this.config().shiftStart,
      outTime: d.outTime ?? this.config().shiftEnd,
      reason: ''
    };
    this.requestVisible = true;
  }

  submitRequest() {
    const e = this.requestEntry;
    if (!e.reason.trim()) {
      this.messages.add({ severity: 'warn', summary: 'Reason required', detail: 'Please describe why the correction is needed.' });
      return;
    }
    const blank = e.status === 'leave' || e.status === 'absent';
    const body = {
      date: this.requestDateIso,
      status: e.status,
      inTime: blank ? null : this.normalizeTime(e.inTime, this.config().shiftStart),
      outTime: blank ? null : this.normalizeTime(e.outTime, this.config().shiftEnd),
      reason: e.reason.trim()
    };
    this.http.post(`${this.base}/corrections`, body).subscribe({
      next: () => {
        this.requestVisible = false;
        this.load();
        this.messages.add({ severity: 'success', summary: 'Correction requested', detail: 'Sent to your manager for approval.' });
      },
      error: (err) =>
        this.messages.add({ severity: 'error', summary: 'Request failed', detail: err?.error?.message ?? 'Could not submit the correction.' })
    });
  }

  cancelCorrection(c: Correction) {
    this.http.post(`${this.base}/corrections/${c.id}/cancel`, {}).subscribe({
      next: () => {
        this.load();
        this.messages.add({ severity: 'info', summary: 'Request cancelled', detail: 'Your correction request was withdrawn.' });
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Cancel failed', detail: 'Could not cancel the request.' })
    });
  }

  // ---- manager decisions ----
  approveCorrection(c: Correction) {
    this.decideCorrection(c, 'approve');
  }
  rejectCorrection(c: Correction) {
    this.decideCorrection(c, 'reject');
  }

  private decideCorrection(c: Correction, action: 'approve' | 'reject') {
    this.http.post(`${this.base}/corrections/${c.id}/${action}`, {}).subscribe({
      next: () => {
        this.loadTeamCorrections();
        if (this.data()?.employeeId === c.employeeId) this.load();
        const done = action === 'approve' ? 'approved' : 'rejected';
        this.messages.add({ severity: action === 'approve' ? 'success' : 'info', summary: `Correction ${done}`, detail: `${c.employeeName} · ${c.date}` });
      },
      error: (err) => this.messages.add({ severity: 'error', summary: 'Action failed', detail: err?.error?.message ?? 'Could not update the request.' })
    });
  }

  shiftMonth(delta: number) {
    let m = this.viewMonth + delta;
    let y = this.viewYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    this.viewMonth = m;
    this.viewYear = y;
    this.load();
  }

  goToday() {
    this.viewYear = this.now.getFullYear();
    this.viewMonth = this.now.getMonth() + 1;
    this.load();
  }

  selectDay(d: MonthDay) {
    if (d.status === 'upcoming') return;
    this.selectedDay.set(d);
  }

  isToday(d: MonthDay): boolean {
    return d.date === this.toIso(this.now);
  }

  /** HR/admins edit anyone; a team lead edits a report (not their own record). */
  canEdit(): boolean {
    const acc = this.hrAccess.access();
    if (!acc) return false;
    if (acc.canManage) return true;
    if (acc.isTeamLead) return this.data()?.employeeId !== acc.employeeId;
    return false;
  }

  cellClass(d: MonthDay): string {
    const selected = this.selectedDay()?.date === d.date;
    return this.tones[d.status].wrap + (selected ? ' ring-2 ring-brand-400 dark:ring-brand-500' : '');
  }

  shortLabel(s: AttStatus): string {
    return { present: 'Present', wfh: 'WFH', late: 'Late', leave: 'Leave', absent: 'Absent', weekoff: 'Off', upcoming: '' }[s];
  }

  // ---- config dialog ----
  openConfig() {
    this.draft = { ...this.config(), weekendDays: [...this.config().weekendDays] };
    this.configVisible = true;
  }

  resetConfig() {
    this.draft = { ...AttendanceComponent.DEFAULT_CONFIG, weekendDays: [...AttendanceComponent.DEFAULT_CONFIG.weekendDays] };
  }

  saveConfig() {
    const c: AttendanceConfig = {
      shiftStart: this.normalizeTime(this.draft.shiftStart, '09:00'),
      shiftEnd: this.normalizeTime(this.draft.shiftEnd, '18:00'),
      graceMinutes: this.draft.graceMinutes ?? 15,
      fullDayHours: this.draft.fullDayHours ?? 9,
      overtimeThresholdHours: this.draft.overtimeThresholdHours ?? 9,
      weekendDays: [...(this.draft.weekendDays ?? [])].sort((a, b) => a - b)
    };
    this.config.set(c);
    try {
      localStorage.setItem(AttendanceComponent.CONFIG_KEY, JSON.stringify(c));
    } catch {
      /* localStorage unavailable — keep in-memory */
    }
    this.configVisible = false;
    this.load();
    this.messages.add({ severity: 'success', summary: 'Policy updated', detail: 'Attendance configuration applied.' });
  }

  // ---- per-day edit ----
  openEdit(d: MonthDay) {
    const data = this.data();
    if (!data) return;
    this.editName = data.employeeName;
    this.editDateIso = d.date;
    this.editEntry = {
      status: d.status === 'weekoff' || d.status === 'upcoming' ? 'present' : d.status,
      inTime: d.inTime ?? this.config().shiftStart,
      outTime: d.outTime ?? this.config().shiftEnd
    };
    this.editVisible = true;
  }

  saveEntry() {
    const data = this.data();
    if (!data) return;
    const e = this.editEntry;
    const blank = e.status === 'leave' || e.status === 'absent';
    const body = {
      employeeId: data.employeeId,
      date: this.editDateIso,
      status: e.status,
      inTime: blank ? null : this.normalizeTime(e.inTime, this.config().shiftStart),
      outTime: blank ? null : this.normalizeTime(e.outTime, this.config().shiftEnd)
    };
    this.http.put(`${this.base}/entry`, body).subscribe({
      next: () => {
        this.editVisible = false;
        this.load();
        this.messages.add({ severity: 'success', summary: 'Attendance updated', detail: `${this.editName} · ${this.label(e.status)}` });
      },
      error: (err) =>
        this.messages.add({
          severity: 'error',
          summary: 'Update failed',
          detail: err?.error?.message ?? 'Could not save the attendance edit.'
        })
    });
  }

  resetEntry(d: MonthDay) {
    const data = this.data();
    if (!data) return;
    const params = new HttpParams().set('employeeId', data.employeeId).set('date', d.date);
    this.http.delete(`${this.base}/entry`, { params }).subscribe({
      next: () => {
        this.load();
        this.messages.add({ severity: 'info', summary: 'Reverted', detail: `${data.employeeName} reset to system entry.` });
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Reset failed', detail: 'Could not reset the entry.' })
    });
  }

  private loadConfig(): AttendanceConfig {
    try {
      const raw = localStorage.getItem(AttendanceComponent.CONFIG_KEY);
      if (raw) return { ...AttendanceComponent.DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...AttendanceComponent.DEFAULT_CONFIG, weekendDays: [...AttendanceComponent.DEFAULT_CONFIG.weekendDays] };
  }

  private normalizeTime(v: string, fallback: string): string {
    const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? '').trim());
    if (!m) return fallback;
    const h = Math.min(23, Math.max(0, +m[1]));
    const min = Math.min(59, Math.max(0, +m[2]));
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  exportCsv() {
    const d = this.data();
    if (!d) return;
    const rows = d.days.filter((x) => x.status !== 'upcoming');
    if (!rows.length) {
      this.messages.add({ severity: 'info', summary: 'Nothing to export', detail: 'No attendance to export for this month.' });
      return;
    }
    const headers = ['Date', 'Weekday', 'Status', 'In', 'Out', 'Hours', 'Late by (min)', 'Overtime (min)', 'Location'];
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [r.date, this.weekdayLabels[r.weekday], this.label(r.status), r.inTime ?? '', r.outTime ?? '', r.hours, r.lateByMin, r.overtimeMin, r.location]
        .map(cell)
        .join(',')
    );
    const csv = [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${d.employeeCode}-${d.year}-${String(d.month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.messages.add({ severity: 'success', summary: 'Export ready', detail: `${rows.length} days exported.` });
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  tone(s: AttStatus): StatusTone {
    return { present: 'success', wfh: 'info', late: 'warn', absent: 'danger', leave: 'neutral', weekoff: 'neutral', upcoming: 'neutral' }[s] as StatusTone;
  }
  label(s: AttStatus): string {
    return { present: 'Present', wfh: 'Work from home', late: 'Late', absent: 'Absent', leave: 'On leave', weekoff: 'Week off', upcoming: 'Upcoming' }[s];
  }
}
