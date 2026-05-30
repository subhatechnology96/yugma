import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '@env/environment';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
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
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';

type AttStatus = 'present' | 'wfh' | 'late' | 'leave' | 'absent' | 'weekoff';

interface AttendanceRow {
  employeeId: string;
  name: string;
  code: string;
  department: string;
  designation: string;
  avatarUrl?: string;
  shift: string;
  status: AttStatus;
  inTime: string | null;
  outTime: string | null;
  hours: number;
  expectedHours: number;
  lateByMin: number;
  overtimeMin: number;
  location: string;
  isManual: boolean;
}

interface DeptAttendance {
  department: string;
  total: number;
  present: number;
  wfh: number;
  late: number;
  onLeave: number;
  absent: number;
  attendanceRatePct: number;
}

interface AttendanceSummary {
  total: number;
  present: number;
  wfh: number;
  late: number;
  onLeave: number;
  absent: number;
  presentPct: number;
  wfhPct: number;
  latePct: number;
  leavePct: number;
  absentPct: number;
  attendanceRatePct: number;
  onTimePct: number;
  avgHours: number;
  totalHours: number;
  overtimeHours: number;
}

interface AttendanceRoster {
  date: string;
  dayName: string;
  isWeekend: boolean;
  showingCount: number;
  summary: AttendanceSummary;
  departments: DeptAttendance[];
  rows: AttendanceRow[];
}

interface AttendanceConfig {
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  fullDayHours: number;
  overtimeThresholdHours: number;
  weekendDays: number[];
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    TableModule,
    ButtonModule,
    DatePickerModule,
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
    <app-page-header eyebrow="HR · Time" title="Attendance" subtitle="Daily punches, late arrivals, work-from-home and absences across departments.">
      <button pButton severity="secondary" outlined icon="pi pi-cog" label="Configure" (click)="openConfig()"></button>
      <button pButton severity="secondary" outlined icon="pi pi-download" label="Export" (click)="exportCsv()"></button>
      <button pButton icon="pi pi-bolt" label="Mark bulk"></button>
    </app-page-header>

    <app-hr-agent-rail [keys]="['active.attendance', 'active.copilot']" title="Attendance co-pilots" />

    @if (data(); as d) {
      <!-- Primary KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <app-kpi-card label="Present" [value]="d.summary.present" icon="pi-check" tone="emerald" [caption]="d.summary.presentPct + '% of ' + d.summary.total" />
        <app-kpi-card label="WFH" [value]="d.summary.wfh" icon="pi-home" tone="indigo" [caption]="d.summary.wfhPct + '% of ' + d.summary.total" />
        <app-kpi-card label="Late" [value]="d.summary.late" icon="pi-clock" tone="amber" [caption]="d.summary.latePct + '% of ' + d.summary.total" />
        <app-kpi-card label="Leave" [value]="d.summary.onLeave" icon="pi-calendar" tone="brand" caption="Approved today" />
        <app-kpi-card label="Absent" [value]="d.summary.absent" icon="pi-times" tone="rose" caption="Not punched in" />
      </div>

      <!-- Secondary stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div class="card p-4">
          <div class="text-xs text-surface-500 mb-1">Attendance rate</div>
          <div class="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{{ d.summary.attendanceRatePct }}%</div>
          <div class="h-1.5 mt-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
            <div class="h-full rounded-full bg-emerald-500" [style.width.%]="d.summary.attendanceRatePct"></div>
          </div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-surface-500 mb-1">On-time rate</div>
          <div class="text-xl font-semibold">{{ d.summary.onTimePct }}%</div>
          <div class="text-[11px] text-surface-500 mt-2">{{ d.summary.late }} late arrival(s)</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-surface-500 mb-1">Avg hours / employee</div>
          <div class="text-xl font-semibold">{{ d.summary.avgHours }}h</div>
          <div class="text-[11px] text-surface-500 mt-2">{{ d.summary.totalHours | number: '1.0-0' }}h logged today</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-surface-500 mb-1">Overtime</div>
          <div class="text-xl font-semibold">{{ d.summary.overtimeHours }}h</div>
          <div class="text-[11px] text-surface-500 mt-2">beyond 9h shift</div>
        </div>
      </div>

      <!-- Distribution bar -->
      <div class="card p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="section-title">Workforce status · {{ d.dayName }}, {{ d.date | date: 'mediumDate' }}</div>
          <div class="text-xs text-surface-500">{{ d.summary.total }} employees</div>
        </div>
        <div class="flex h-3 rounded-full overflow-hidden bg-surface-100 dark:bg-surface-800">
          <div class="bg-emerald-500 h-full" [style.width.%]="d.summary.presentPct" [pTooltip]="'Present ' + d.summary.present"></div>
          <div class="bg-brand-500 h-full" [style.width.%]="d.summary.wfhPct" [pTooltip]="'WFH ' + d.summary.wfh"></div>
          <div class="bg-amber-500 h-full" [style.width.%]="d.summary.latePct" [pTooltip]="'Late ' + d.summary.late"></div>
          <div class="bg-surface-400 h-full" [style.width.%]="d.summary.leavePct" [pTooltip]="'On leave ' + d.summary.onLeave"></div>
          <div class="bg-rose-500 h-full" [style.width.%]="d.summary.absentPct" [pTooltip]="'Absent ' + d.summary.absent"></div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-surface-500">
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Present</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-brand-500"></span>WFH</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Late</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-surface-400"></span>On leave</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Absent</span>
        </div>
      </div>

      <!-- Department breakdown -->
      <div class="card p-4 mb-4">
        <div class="section-title mb-3">Department breakdown</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          @for (dep of d.departments; track dep.department) {
            <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm font-medium truncate">{{ dep.department }}</span>
                <span class="text-xs font-semibold" [class.text-emerald-600]="dep.attendanceRatePct >= 80" [class.text-amber-600]="dep.attendanceRatePct < 80 && dep.attendanceRatePct >= 60" [class.text-rose-600]="dep.attendanceRatePct < 60">{{ dep.attendanceRatePct }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <div class="h-full rounded-full bg-brand-500" [style.width.%]="dep.attendanceRatePct"></div>
              </div>
              <div class="text-[11px] text-surface-500 mt-1.5">
                {{ dep.present + dep.wfh + dep.late }}/{{ dep.total }} in · {{ dep.onLeave }} leave · {{ dep.absent }} absent
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Roster -->
      <div class="card">
        <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-3">
          <p-datepicker [(ngModel)]="date" (onSelect)="load()" dateFormat="dd M yy" [showIcon]="true" inputStyleClass="!rounded-lg" />
          <p-select [options]="depts()" [(ngModel)]="dept" (onChange)="load()" placeholder="All departments" styleClass="!rounded-lg" />
          <span class="relative flex-1 min-w-[14rem]">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
            <input pInputText [(ngModel)]="search" (keydown.enter)="load()" (input)="onSearchInput()" placeholder="Search employee, code, role…" class="w-full !pl-10 !rounded-lg" />
          </span>
          <span class="ml-auto text-xs text-surface-500">Showing {{ d.showingCount }} of {{ d.summary.total }} employees</span>
        </div>

        <button type="button" (click)="openConfig()"
          class="w-full text-left px-4 py-2 text-[11px] text-surface-500 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-surface-50 dark:hover:bg-surface-900/40 transition-colors">
          <span class="text-brand-600 dark:text-brand-300 font-medium"><i class="pi pi-cog mr-1"></i>Policy</span>
          <span>Shift {{ config().shiftStart }}–{{ config().shiftEnd }}</span>
          <span>· {{ config().graceMinutes }}m grace</span>
          <span>· {{ config().fullDayHours }}h full day</span>
          <span>· OT after {{ config().overtimeThresholdHours }}h</span>
          <span>· Week off: {{ weekendLabel() }}</span>
          <span class="ml-auto text-brand-600 dark:text-brand-300">Edit policy <i class="pi pi-pencil text-[10px]"></i></span>
        </button>

        @if (d.isWeekend) {
          <div class="px-4 py-2.5 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-b border-amber-100 dark:border-amber-500/20">
            <i class="pi pi-info-circle mr-1"></i> {{ d.dayName }} is a weekly off — punches are not expected.
          </div>
        }

        <p-table [value]="d.rows" responsiveLayout="scroll" [rowHover]="true" [paginator]="d.rows.length > 12" [rows]="12">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">Employee</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">Department</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">Shift</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">In</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">Out</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500 !text-right">Hours</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">Location</th>
              <th class="!text-xs !uppercase !tracking-wider !text-surface-500">Status</th>
              <th class="!w-12"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-r>
            <tr>
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
              <td class="text-xs text-surface-500">{{ r.shift }}</td>
              <td class="tabular-nums">
                {{ r.inTime ?? '—' }}
                @if (r.lateByMin > 0) {
                  <span class="ml-1 text-[10px] text-amber-600 dark:text-amber-400">+{{ r.lateByMin }}m</span>
                }
              </td>
              <td class="tabular-nums">{{ r.outTime ?? '—' }}</td>
              <td class="text-right tabular-nums">
                {{ r.hours ? (r.hours | number: '1.1-1') + 'h' : '—' }}
                @if (r.overtimeMin > 0) {
                  <span class="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">OT {{ r.overtimeMin }}m</span>
                }
              </td>
              <td class="text-sm text-surface-500">{{ r.location }}</td>
              <td>
                <div class="flex items-center gap-1.5">
                  <app-status-pill [tone]="tone(r.status)">{{ label(r.status) }}</app-status-pill>
                  @if (r.isManual) {
                    <i class="pi pi-pencil text-[10px] text-brand-500" pTooltip="Manually edited"></i>
                  }
                </div>
              </td>
              <td>
                <button pButton text rounded size="small" icon="pi pi-pencil" pTooltip="Edit timing" class="!text-surface-500" (click)="openEdit(r)"></button>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="9" class="py-10 text-center text-surface-500">No employees match your filters.</td></tr>
          </ng-template>
        </p-table>
      </div>
    } @else {
      <div class="card p-10 grid place-items-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl"></i></div>
    }

    <!-- Attendance policy configuration -->
    <p-dialog header="Attendance configuration" [(visible)]="configVisible" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <p class="text-xs text-surface-500">These settings define your attendance policy and immediately drive the board's punches, late flags, overtime and week-offs.</p>

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

    <!-- Edit an employee's punch for the day -->
    <p-dialog [header]="'Edit attendance · ' + editName" [(visible)]="editVisible" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <p class="text-xs text-surface-500">{{ editDate | date: 'fullDate' }}</p>

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
        <button pButton severity="danger" text label="Reset to system" icon="pi pi-undo" (click)="resetEntry()"></button>
        <button pButton severity="secondary" outlined label="Cancel" (click)="editVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="saveEntry()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class AttendanceComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/hr/attendance`;

  protected date = new Date();
  protected dept: string | null = null;
  protected search = '';

  protected readonly data = signal<AttendanceRoster | null>(null);
  protected readonly depts = signal<{ label: string; value: string | null }[]>([
    { label: 'All departments', value: null }
  ]);

  // ---- attendance policy configuration ----
  private static readonly CONFIG_KEY = 'yugma.attendance.config';
  private static readonly DEFAULT_CONFIG: AttendanceConfig = {
    shiftStart: '09:00',
    shiftEnd: '18:00',
    graceMinutes: 15,
    fullDayHours: 9,
    overtimeThresholdHours: 9,
    weekendDays: [0, 6]
  };
  protected readonly dayOptions = [
    { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }
  ];
  protected readonly config = signal<AttendanceConfig>(this.loadConfig());
  protected configVisible = false;
  protected draft: AttendanceConfig = { ...this.config(), weekendDays: [...this.config().weekendDays] };

  // ---- per-employee timing edit ----
  protected readonly statusOptions = [
    { label: 'Present', value: 'present' },
    { label: 'Work from home', value: 'wfh' },
    { label: 'Late', value: 'late' },
    { label: 'On leave', value: 'leave' },
    { label: 'Absent', value: 'absent' }
  ];
  protected editVisible = false;
  protected editName = '';
  protected editDate = new Date();
  protected editEntry: { employeeId: string; status: AttStatus; inTime: string; outTime: string } = {
    employeeId: '',
    status: 'present',
    inTime: '',
    outTime: ''
  };

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.http.get<string[]>(`${this.base}/departments`).subscribe((list) =>
      this.depts.set([{ label: 'All departments', value: null }, ...list.map((d) => ({ label: d, value: d }))])
    );
    this.load();
  }

  load() {
    const c = this.config();
    let params = new HttpParams()
      .set('date', this.toIso(this.date))
      .set('shiftStart', c.shiftStart)
      .set('shiftEnd', c.shiftEnd)
      .set('graceMinutes', String(c.graceMinutes))
      .set('fullDayHours', String(c.fullDayHours))
      .set('overtimeThresholdHours', String(c.overtimeThresholdHours))
      .set('weekendDays', c.weekendDays.join(','));
    if (this.dept) params = params.set('department', this.dept);
    if (this.search.trim()) params = params.set('search', this.search.trim());
    this.http.get<AttendanceRoster>(`${this.base}/daily`, { params }).subscribe((d) => this.data.set(d));
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

  // ---- per-employee timing edit ----
  openEdit(r: AttendanceRow) {
    this.editName = r.name;
    this.editDate = this.date;
    this.editEntry = {
      employeeId: r.employeeId,
      status: r.status === 'weekoff' ? 'present' : r.status,
      inTime: r.inTime ?? this.config().shiftStart,
      outTime: r.outTime ?? this.config().shiftEnd
    };
    this.editVisible = true;
  }

  saveEntry() {
    const e = this.editEntry;
    const blank = e.status === 'leave' || e.status === 'absent';
    const body = {
      employeeId: e.employeeId,
      date: this.toIso(this.editDate),
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
      error: () => this.messages.add({ severity: 'error', summary: 'Update failed', detail: 'Could not save the attendance edit.' })
    });
  }

  resetEntry() {
    const params = new HttpParams().set('employeeId', this.editEntry.employeeId).set('date', this.toIso(this.editDate));
    this.http.delete(`${this.base}/entry`, { params }).subscribe(() => {
      this.editVisible = false;
      this.load();
      this.messages.add({ severity: 'info', summary: 'Reverted', detail: `${this.editName} reset to system entry.` });
    });
  }

  weekendLabel(): string {
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = this.config().weekendDays;
    return days.length ? days.map((d) => map[d]).join(', ') : 'None';
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

  onSearchInput() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  exportCsv() {
    const d = this.data();
    if (!d || !d.rows.length) {
      this.messages.add({ severity: 'info', summary: 'Nothing to export', detail: 'No attendance rows to export.' });
      return;
    }
    const headers = ['Code', 'Name', 'Department', 'Designation', 'Shift', 'In', 'Out', 'Hours', 'Late by (min)', 'Overtime (min)', 'Location', 'Status'];
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = d.rows.map((r) =>
      [r.code, r.name, r.department, r.designation, r.shift, r.inTime ?? '', r.outTime ?? '', r.hours, r.lateByMin, r.overtimeMin, r.location, this.label(r.status)]
        .map(cell)
        .join(',')
    );
    const csv = [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${this.toIso(this.date)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.messages.add({ severity: 'success', summary: 'Export ready', detail: `${d.rows.length} rows exported.` });
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  tone(s: AttStatus): StatusTone {
    return { present: 'success', wfh: 'info', late: 'warn', absent: 'danger', leave: 'neutral', weekoff: 'neutral' }[s] as StatusTone;
  }
  label(s: AttStatus): string {
    return { present: 'Present', wfh: 'Work from home', late: 'Late', absent: 'Absent', leave: 'On leave', weekoff: 'Week off' }[s];
  }
}
