import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { EmployeeService } from '../services/employee.service';
import { EmployeeProfileService } from '../services/employee-profile.service';
import { HrAccessService } from '@core/services/hr-access.service';
import { environment } from '@env/environment';
import { Employee } from '../models/hr.models';
import {
  AttendanceDay,
  AttendanceOverview,
  Career,
  CareerProject,
  EmployeeDocument,
  EmployeeOverview,
  LeaveOverview,
  Payslip,
  PayrollOverview
} from '../models/employee-profile.models';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    RouterLink,
    ButtonModule,
    TabsModule,
    TagModule,
    TooltipModule,
    TableModule,
    DialogModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    DatePickerModule,
    FormsModule,
    PageHeaderComponent,
    StatusPillComponent,
    AvatarComponent,
    EmptyStateComponent,
    HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-detail.component.html'
})
export class EmployeeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(EmployeeService);
  private readonly profile = inject(EmployeeProfileService);
  private readonly messages = inject(MessageService);
  private readonly http = inject(HttpClient);

  protected readonly loading = signal(true);
  protected readonly employee = signal<Employee | null>(null);
  private employeeId = '';

  protected readonly overview = signal<EmployeeOverview | null>(null);
  protected readonly attendance = signal<AttendanceOverview | null>(null);
  protected readonly leave = signal<LeaveOverview | null>(null);
  protected readonly payroll = signal<PayrollOverview | null>(null);
  protected readonly documents = signal<EmployeeDocument[] | null>(null);
  protected readonly career = signal<Career | null>(null);

  /** Admin / HR / manager can add & edit tracked projects. */
  private readonly hrAccess = inject(HrAccessService);
  protected readonly canEdit = computed(() => this.hrAccess.canManage());

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.employeeId = id;
    this.svc.byId(id).subscribe((e) => {
      this.employee.set(e ?? null);
      this.loading.set(false);
    });

    // Load the rich profile sections in parallel so tab switches are instant.
    this.profile.overview(id).subscribe((d) => this.overview.set(d));
    this.profile.attendance(id).subscribe((d) => {
      this.attendance.set(d);
      // Open the calendar on the most recent month that has records.
      const recs = d?.records ?? [];
      if (recs.length) {
        const k = recs.reduce((a, b) => (a.date > b.date ? a : b)).date.slice(0, 10);
        this.calMonth.set({ y: +k.slice(0, 4), m: +k.slice(5, 7) - 1 });
      }
    });
    this.profile.leave(id).subscribe((d) => this.leave.set(d));
    this.profile.payroll(id).subscribe((d) => this.payroll.set(d));
    this.profile.documents(id).subscribe((d) => this.documents.set(d));
    this.loadCareer();
  }

  private loadCareer() {
    this.profile.career(this.employeeId).subscribe((d) => this.career.set(d));
  }

  tenureYears(iso: string): number {
    const yrs = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(yrs * 10) / 10;
  }

  // ---- presentation helpers ----
  attendanceTone(status: string): StatusTone {
    switch (status) {
      case 'Present': return 'success';
      case 'Wfh': return 'info';
      case 'Late': return 'warn';
      case 'Absent': return 'danger';
      default: return 'neutral';
    }
  }
  attendanceLabel(status: string): string {
    return status === 'Wfh' ? 'WFH' : status === 'Leave' ? 'On leave' : status;
  }

  // ---- attendance calendar (month / year-wise) ----
  protected readonly calMonth = signal<{ y: number; m: number } | null>(null);
  protected readonly weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  protected readonly monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ].map((label, value) => ({ label, value }));

  /** Selectable years: every year that has records, padded to a changeable span. */
  protected readonly yearOptions = computed(() => {
    const years = new Set<number>();
    for (const i of this.recordMonths()) years.add(Math.floor(i / 12));
    const c = this.calMonth();
    if (c) years.add(c.y);
    if (years.size === 0) years.add(new Date().getFullYear());
    const max = Math.max(...years);
    for (let y = max - 2; y <= max + 1; y++) years.add(y);
    return [...years].sort((a, b) => b - a).map((y) => ({ label: String(y), value: y }));
  });

  // Two-way bindings for the month / year dropdowns.
  protected get calMonthM(): number { return this.calMonth()?.m ?? 0; }
  protected set calMonthM(m: number) { const c = this.calMonth(); this.calMonth.set({ y: c?.y ?? new Date().getFullYear(), m }); }
  protected get calMonthY(): number { return this.calMonth()?.y ?? new Date().getFullYear(); }
  protected set calMonthY(y: number) { const c = this.calMonth(); this.calMonth.set({ y, m: c?.m ?? 0 }); }

  private readonly recordsByDay = computed(() => {
    const map = new Map<string, AttendanceDay>();
    for (const r of this.attendance()?.records ?? []) map.set(r.date.slice(0, 10), r);
    return map;
  });

  /** Distinct months that have records, as sortable indices (year*12 + month). */
  private readonly recordMonths = computed(() => {
    const set = new Set<number>();
    for (const r of this.attendance()?.records ?? []) {
      const k = r.date.slice(0, 10);
      set.add(+k.slice(0, 4) * 12 + (+k.slice(5, 7) - 1));
    }
    return [...set].sort((a, b) => a - b);
  });

  protected prevMonth(): void {
    const c = this.calMonth(); if (!c) return;
    const i = c.y * 12 + c.m - 1; this.calMonth.set({ y: Math.floor(i / 12), m: ((i % 12) + 12) % 12 });
  }
  protected nextMonth(): void {
    const c = this.calMonth(); if (!c) return;
    const i = c.y * 12 + c.m + 1; this.calMonth.set({ y: Math.floor(i / 12), m: i % 12 });
  }

  /** A Monday-first month grid: weeks of 7 cells; out-of-month cells have day = 0. */
  protected readonly calendar = computed(() => {
    const c = this.calMonth();
    if (!c) return null;
    const { y, m } = c;
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;                 // blanks before the 1st (Mon-based)
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const byDay = this.recordsByDay();
    type Cell = { day: number; inMonth: boolean; rec: AttendanceDay | null };
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++) cells.push({ day: 0, inMonth: false, rec: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, inMonth: true, rec: byDay.get(key) ?? null });
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0, inMonth: false, rec: null });
    const weeks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), weeks };
  });

  /** Cell fill + border colour by status. */
  attendanceCellClass(rec: AttendanceDay | null): string {
    switch (rec?.status) {
      case 'Present': return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
      case 'Wfh':     return 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30';
      case 'Late':    return 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
      case 'Leave':   return 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30';
      case 'Absent':  return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30';
      default:        return 'bg-surface-50/40 dark:bg-surface-900/20 border-surface-100 dark:border-surface-800';
    }
  }
  /** Accent text colour matching the status. */
  attendanceTextClass(rec: AttendanceDay | null): string {
    switch (rec?.status) {
      case 'Present': return 'text-emerald-700 dark:text-emerald-300';
      case 'Wfh':     return 'text-indigo-700 dark:text-indigo-300';
      case 'Late':    return 'text-amber-700 dark:text-amber-300';
      case 'Leave':   return 'text-violet-700 dark:text-violet-300';
      case 'Absent':  return 'text-rose-700 dark:text-rose-300';
      default:        return 'text-surface-400';
    }
  }

  leaveTone(status: string): StatusTone {
    return status === 'Approved' ? 'success' : status === 'Pending' ? 'warn' : 'danger';
  }

  // ---- apply for leave ----
  protected leaveDialogVisible = false;
  protected readonly savingLeave = signal(false);
  protected readonly leaveTypeOptions = [
    { label: 'Casual', value: 'Casual' },
    { label: 'Sick', value: 'Sick' },
    { label: 'Earned', value: 'Earned' },
    { label: 'Paid leave', value: 'Paid' },
    { label: 'Comp-off', value: 'CompOff' },
    { label: 'Special leave', value: 'Special' },
    { label: 'Unpaid', value: 'Unpaid' }
  ];
  protected leaveForm: { type: string; from: Date | null; to: Date | null; reason: string } =
    { type: 'Casual', from: null, to: null, reason: '' };

  protected openLeaveApply(): void {
    const today = new Date();
    this.leaveForm = { type: 'Casual', from: today, to: today, reason: '' };
    this.leaveDialogVisible = true;
  }

  /** Inclusive day count between the chosen dates (0 when invalid). */
  protected leaveDays(): number {
    const f = this.leaveForm.from, t = this.leaveForm.to;
    if (!f || !t) return 0;
    const a = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
    const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    return b < a ? 0 : Math.round((b - a) / 86_400_000) + 1;
  }

  protected submitLeave(): void {
    const f = this.leaveForm;
    if (!f.from || !f.to || this.leaveDays() < 1) {
      this.messages.add({ severity: 'warn', summary: 'Check the dates', detail: 'Please pick a valid date range.' });
      return;
    }
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days = this.leaveDays();
    const label = this.leaveTypeOptions.find((o) => o.value === f.type)?.label ?? f.type;
    const body = {
      employee: this.employee()?.fullName ?? '',
      type: f.type,
      from: fmt(f.from),
      to: fmt(f.to),
      days,
      reason: f.reason?.trim() ?? ''
    };
    this.savingLeave.set(true);
    this.http.post(`${environment.apiBaseUrl}/hr/leave`, body).subscribe({
      next: () => {
        this.savingLeave.set(false);
        this.leaveDialogVisible = false;
        this.messages.add({ severity: 'success', summary: 'Leave applied', detail: `${label} · ${days} day${days > 1 ? 's' : ''}` });
        // Refresh balances + history so the new pending request shows immediately.
        this.profile.leave(this.employeeId).subscribe((d) => this.leave.set(d));
      },
      error: (e) => {
        this.savingLeave.set(false);
        this.messages.add({ severity: 'error', summary: 'Could not apply', detail: e?.error?.message ?? 'Please try again.' });
      }
    });
  }

  // ---- payslip history filter (month / year, capped at 10 rows) ----
  protected readonly maxPayslips = 10;
  protected payMonth: number | null = null;   // 0-11, or null = all months
  protected payYear: number | null = null;    // null = all years
  protected readonly payMonthOptions: { label: string; value: number | null }[] =
    [{ label: 'All months', value: null }, ...this.monthOptions];

  /** Years present in the payslip history, plus an "all years" option. */
  protected readonly payYearOptions = computed(() => {
    const years = new Set<number>();
    for (const p of this.payroll()?.payslips ?? []) years.add(new Date(p.payDate).getFullYear());
    const opts: { label: string; value: number | null }[] =
      [...years].sort((a, b) => b - a).map((y) => ({ label: String(y), value: y }));
    return [{ label: 'All years', value: null }, ...opts];
  });

  /** Payslips matching the chosen month/year, newest first, capped at maxPayslips. */
  protected filteredPayslips(): Payslip[] {
    const all = this.payroll()?.payslips ?? [];
    return all
      .filter((p) => {
        const d = new Date(p.payDate);
        return (this.payMonth === null || d.getMonth() === this.payMonth)
          && (this.payYear === null || d.getFullYear() === this.payYear);
      })
      .slice(0, this.maxPayslips);
  }

  /** Total matches before the 10-row cap (for the "showing X of Y" hint). */
  protected payslipMatchCount(): number {
    return (this.payroll()?.payslips ?? []).filter((p) => {
      const d = new Date(p.payDate);
      return (this.payMonth === null || d.getMonth() === this.payMonth)
        && (this.payYear === null || d.getFullYear() === this.payYear);
    }).length;
  }

  docTone(status: string): StatusTone {
    return status === 'Verified' ? 'success' : status === 'Pending' ? 'warn' : 'danger';
  }

  docIcon(fileType: string): string {
    const t = fileType.toUpperCase();
    if (t === 'PDF') return 'pi-file-pdf';
    if (t === 'JPG' || t === 'JPEG' || t === 'PNG') return 'pi-image';
    if (t === 'DOC' || t === 'DOCX') return 'pi-file-word';
    return 'pi-file';
  }

  fileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  usedPct(used: number, entitled: number): number {
    return entitled <= 0 ? 0 : Math.min(100, Math.round((used / entitled) * 100));
  }

  // ---- career: collapsible sections ----
  protected readonly timelineOpen = signal(true);
  protected readonly expandedProjects = signal<Set<string>>(new Set());

  toggleTimeline() { this.timelineOpen.update((v) => !v); }
  isProjectOpen(id: string): boolean { return this.expandedProjects().has(id); }
  toggleProject(id: string) {
    this.expandedProjects.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---- career helpers ----
  projectTone(status: string): StatusTone {
    return status === 'Completed' ? 'success' : status === 'Ongoing' ? 'info' : 'warn';
  }
  eventIconBg(type: string): string {
    switch (type) {
      case 'joined': return 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300';
      case 'promotion': return 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
      case 'award': return 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300';
      default: return 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300';
    }
  }

  // ---- project dialogs ----
  protected projectVisible = false;
  protected readonly selectedProject = signal<CareerProject | null>(null);
  protected formVisible = false;
  protected editId: string | null = null;
  protected pform = this.blankProject();
  protected readonly statusOptions = ['Completed', 'Ongoing', 'On hold'];

  openProject(p: CareerProject) {
    this.selectedProject.set(p);
    this.projectVisible = true;
  }

  openAddProject() {
    this.editId = null;
    this.pform = this.blankProject();
    this.formVisible = true;
  }

  editProject(p: CareerProject) {
    this.projectVisible = false;
    this.editId = p.id;
    this.pform = {
      name: p.name, domain: p.domain, role: p.role, manager: p.manager,
      startDate: p.startDate.slice(0, 10), endDate: p.endDate ? p.endDate.slice(0, 10) : '',
      status: p.status, rating: p.rating, responsibilities: p.responsibilities.join('\n'),
      outcome: p.outcome, feedback: p.feedback, skills: p.skills.join(', '), teamSize: p.teamSize
    };
    this.formVisible = true;
  }

  saveProject() {
    const f = this.pform;
    const body = {
      name: f.name, domain: f.domain, role: f.role, manager: f.manager,
      startDate: f.startDate, endDate: f.endDate || null, status: f.status, rating: f.rating,
      responsibilities: f.responsibilities, outcome: f.outcome, feedback: f.feedback, skills: f.skills, teamSize: f.teamSize
    };
    const req = this.editId
      ? this.profile.updateProject(this.editId, body)
      : this.profile.addProject(this.employeeId, body);
    req.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: this.editId ? 'Project updated' : 'Project added', detail: f.name });
        this.formVisible = false;
        this.loadCareer();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not save the project.' })
    });
  }

  deleteProject(p: CareerProject) {
    this.profile.deleteProject(p.id).subscribe(() => {
      this.messages.add({ severity: 'info', summary: 'Project removed', detail: p.name });
      this.projectVisible = false;
      this.loadCareer();
    });
  }

  private blankProject() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      name: '', domain: 'Project', role: this.employee()?.designation ?? '', manager: this.employee()?.manager ?? '',
      startDate: today, endDate: '', status: 'Completed', rating: 4,
      responsibilities: '', outcome: '', feedback: '', skills: '', teamSize: 5
    };
  }
}
