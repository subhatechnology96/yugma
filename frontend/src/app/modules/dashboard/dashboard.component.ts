import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ThemeService } from '@core/services/theme.service';
import { AuthService } from '@core/services/auth.service';
import { HrAccessService } from '@core/services/hr-access.service';
import { environment } from '@env/environment';

interface LeaveSummary { pending: number; approvedMtd: number; rejectedMtd: number; onLeaveToday: number; balanceAvg: number; }
interface TypeBalance { type: string; entitled: number; used: number; pending: number; available: number; }
interface EmployeeBalance { employeeId: string; name: string; department: string; designation: string; avatarUrl?: string; totalEntitled: number; totalUsed: number; totalPending: number; totalAvailable: number; byType: TypeBalance[]; }
interface LeaveRow { id: string; employeeId: string | null; employee: string; type: string; from: string; to: string; days: number; status: string; reason: string; appliedOn: string; }
interface AttendanceSummary { total: number; present: number; wfh: number; late: number; leave: number; absent: number; attendanceRate: number; }
interface EmployeeRow { id: string; fullName: string; department: string; }

interface Kpi { label: string; value: number; caption: string; icon: string; tone: 'brand' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky'; suffix?: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, RouterLink, ChartModule, ButtonModule, TooltipModule,
    PageHeaderComponent, KpiCardComponent, StatusPillComponent, AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Overview" [title]="'Good evening, ' + userName()" [subtitle]="subtitle()">
      <button pButton severity="secondary" outlined icon="pi pi-download" label="Export"></button>
    </app-page-header>

    <!-- Scope banner -->
    @if (scope() !== 'all') {
      <div class="card px-4 py-2.5 mb-4 text-xs"
        [class]="scope() === 'team' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'">
        <i class="pi mr-1" [class.pi-users]="scope() === 'team'" [class.pi-user]="scope() === 'self'"></i>
        @if (scope() === 'team') { This is your team's overview — you and everyone who reports to you. }
        @else { This is your personal overview. }
      </div>
    }

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      @for (k of kpis(); track k.label) {
        <app-kpi-card [label]="k.label" [value]="k.value" [caption]="k.caption" [icon]="k.icon" [tone]="k.tone" [suffix]="k.suffix || ''" />
      }
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
      <!-- Approvals (team/all) or My requests (self) -->
      <div class="card p-5 xl:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="section-title">{{ canManage() ? 'Action required' : 'My requests' }}</div>
            <div class="text-lg font-semibold mt-1">{{ canManage() ? 'Pending leave approvals' : 'My leave requests' }}</div>
          </div>
          <a routerLink="/hr/leave" class="text-xs font-medium text-brand-600 hover:underline">Open leave</a>
        </div>

        @if (canManage()) {
          @if (pendingLeaves().length) {
            <ul class="divide-y divide-surface-200 dark:divide-surface-800">
              @for (a of pendingLeaves(); track a.id) {
                <li class="py-3 flex items-center gap-4">
                  <app-avatar [name]="a.employee" size="sm" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ a.employee }} · {{ a.type }} leave</div>
                    <div class="text-xs text-surface-500 mt-0.5">
                      {{ a.days }} day{{ a.days === 1 ? '' : 's' }} · {{ a.from | date: 'MMM d' }}–{{ a.to | date: 'MMM d' }}
                      @if (a.reason) { · {{ a.reason }} }
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button pButton size="small" severity="secondary" outlined label="Reject" [disabled]="busy()" (click)="decide(a, 'reject')"></button>
                    <button pButton size="small" label="Approve" [disabled]="busy()" (click)="decide(a, 'approve')"></button>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <div class="py-10 text-center text-surface-500"><i class="pi pi-check-circle text-2xl mb-2 block text-emerald-500"></i>No pending approvals. You're all caught up.</div>
          }
        } @else {
          @if (myRequests().length) {
            <ul class="divide-y divide-surface-200 dark:divide-surface-800">
              @for (r of myRequests(); track r.id) {
                <li class="py-3 flex items-center gap-4">
                  <span class="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-surface-100 dark:bg-surface-800"><i class="pi pi-calendar text-surface-500"></i></span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ r.type }} · {{ r.days }} day{{ r.days === 1 ? '' : 's' }}</div>
                    <div class="text-xs text-surface-500 mt-0.5">{{ r.from | date: 'MMM d' }}–{{ r.to | date: 'MMM d' }} · applied {{ r.appliedOn | date: 'MMM d' }}</div>
                  </div>
                  <app-status-pill [tone]="leaveTone(r.status)">{{ r.status | titlecase }}</app-status-pill>
                </li>
              }
            </ul>
          } @else {
            <div class="py-10 text-center text-surface-500"><i class="pi pi-inbox text-2xl mb-2 block"></i>You have no leave requests yet.</div>
          }
        }
      </div>

      <!-- My leave balance -->
      <div class="card p-5">
        <div class="section-title mb-1">My leave balance</div>
        <div class="text-lg font-semibold mb-4">{{ myBalance()?.totalAvailable || 0 | number: '1.0-0' }} <span class="text-sm font-normal text-surface-500">days available</span></div>
        <div class="space-y-3">
          @for (t of myBalance()?.byType || []; track t.type) {
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-medium">{{ t.type }}</span>
                <span class="text-surface-500">{{ t.available | number: '1.0-0' }} / {{ t.entitled | number: '1.0-0' }}</span>
              </div>
              <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <div class="h-full rounded-full bg-brand-500" [style.width.%]="t.entitled ? (t.available / t.entitled) * 100 : 0"></div>
              </div>
            </div>
          }
          @if (!(myBalance()?.byType?.length)) {
            <div class="text-sm text-surface-500 py-4 text-center">No balance data.</div>
          }
        </div>
      </div>
    </div>

    <!-- Secondary: attendance + (headcount or calendar) -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
      <!-- Attendance today -->
      <div class="card p-5">
        <div class="section-title mb-1">{{ canManage() ? "Today's attendance" : 'My attendance' }}</div>
        <div class="text-lg font-semibold mb-4">{{ today | date: 'EEEE, MMM d' }}</div>
        @if (attendance(); as att) {
          @if (canManage()) {
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3"><div class="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">{{ att.present + att.wfh + att.late }}</div><div class="text-xs text-surface-500">In ({{ att.wfh }} remote)</div></div>
              <div class="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3"><div class="text-2xl font-semibold text-amber-600 dark:text-amber-300">{{ att.late }}</div><div class="text-xs text-surface-500">Late</div></div>
              <div class="rounded-xl bg-brand-50 dark:bg-brand-500/10 p-3"><div class="text-2xl font-semibold text-brand-600 dark:text-brand-300">{{ att.leave }}</div><div class="text-xs text-surface-500">On leave</div></div>
              <div class="rounded-xl bg-rose-50 dark:bg-rose-500/10 p-3"><div class="text-2xl font-semibold text-rose-600 dark:text-rose-300">{{ att.absent }}</div><div class="text-xs text-surface-500">Absent</div></div>
            </div>
            <div class="mt-3 text-xs text-surface-500"><i class="pi pi-chart-line mr-1"></i>{{ att.attendanceRate | number: '1.0-0' }}% attendance across {{ att.total }} {{ scope() === 'team' ? 'team members' : 'people' }}.</div>
          } @else {
            <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 flex items-center gap-3">
              <span class="w-10 h-10 rounded-lg grid place-items-center" [class]="myStatusClass()"><i class="pi" [class]="myStatusIcon()"></i></span>
              <div><div class="font-semibold">{{ myStatusLabel() }}</div><div class="text-xs text-surface-500">Your status today</div></div>
            </div>
          }
        }
      </div>

      <!-- Headcount by department (team/all) -->
      @if (canManage()) {
        <div class="card p-5">
          <div class="section-title mb-1">{{ scope() === 'team' ? 'My team' : 'Workforce' }}</div>
          <div class="text-lg font-semibold mb-3">Headcount by department</div>
          <div class="h-[220px]"><p-chart type="bar" [data]="deptChart()" [options]="barOptions()" /></div>
        </div>
      } @else {
        <!-- self: leave usage donut -->
        <div class="card p-5">
          <div class="section-title mb-1">This year</div>
          <div class="text-lg font-semibold mb-3">My leave usage</div>
          <div class="h-[220px]"><p-chart type="doughnut" [data]="myLeaveChart()" [options]="donutOptions()" /></div>
        </div>
      }

      <!-- Calendar -->
      <div class="card p-5">
        <div class="section-title mb-1">{{ today | date: 'MMMM y' }}</div>
        <div class="text-lg font-semibold mb-3">This month</div>
        <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">
          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          @for (blank of leadingBlanks(); track blank) { <div></div> }
          @for (d of daysInMonth(); track d) {
            <div class="aspect-square rounded-lg grid place-items-center text-xs"
              [class.bg-brand-600]="d === today.getDate()" [class.text-white]="d === today.getDate()" [class.font-semibold]="d === today.getDate()"
              [class.hover:bg-surface-100]="d !== today.getDate()" [class.dark:hover:bg-surface-800]="d !== today.getDate()">{{ d }}</div>
          }
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly hrAccess = inject(HrAccessService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(MessageService);
  private readonly base = environment.apiBaseUrl;

  readonly today = new Date();
  readonly userName = computed(() => this.auth.user()?.fullName?.split(' ')[0] ?? 'there');
  readonly canManage = computed(() => this.hrAccess.canManage());
  readonly scope = computed(() => this.hrAccess.scope());
  readonly busy = signal(false);

  readonly subtitle = computed(() => {
    const s = this.scope();
    const date = this.today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (s === 'self') return `Here's your personal overview for today, ${date}.`;
    if (s === 'team') return `Here's how your team is doing today, ${date}.`;
    return `Here's what's happening across Yugma today, ${date}.`;
  });

  // ── data ──
  private readonly leaveSummary = signal<LeaveSummary>({ pending: 0, approvedMtd: 0, rejectedMtd: 0, onLeaveToday: 0, balanceAvg: 0 });
  private readonly balances = signal<EmployeeBalance[]>([]);
  protected readonly pendingLeaves = signal<LeaveRow[]>([]);
  protected readonly myRequests = signal<LeaveRow[]>([]);
  protected readonly attendance = signal<AttendanceSummary | null>(null);
  private readonly employees = signal<EmployeeRow[]>([]);

  protected readonly myBalance = computed(() => {
    const id = this.hrAccess.access()?.employeeId;
    const list = this.balances();
    return list.find((b) => b.employeeId === id) ?? list[0] ?? null;
  });

  constructor() {
    this.load();
  }

  private load(): void {
    forkJoin({
      summary: this.http.get<LeaveSummary>(`${this.base}/hr/leave/summary`),
      balances: this.http.get<EmployeeBalance[]>(`${this.base}/hr/leave/balances`),
      leaves: this.http.get<LeaveRow[]>(`${this.base}/hr/leave`),
      attendance: this.http.get<{ summary: AttendanceSummary }>(`${this.base}/hr/attendance/daily`),
      employees: this.http.get<{ items: EmployeeRow[] }>(`${this.base}/hr/employees`, { params: new HttpParams().set('pageSize', '200') })
    }).subscribe((r) => {
      this.leaveSummary.set(r.summary);
      this.balances.set(r.balances);
      this.pendingLeaves.set(r.leaves.filter((l) => l.status === 'pending'));
      this.myRequests.set(r.leaves.slice(0, 8));
      this.attendance.set(r.attendance.summary);
      this.employees.set(r.employees.items);
    });
  }

  // ── KPIs (scope-aware) ──
  readonly kpis = computed<Kpi[]>(() => {
    const sum = this.leaveSummary();
    const att = this.attendance();
    const bal = this.myBalance();
    if (!this.canManage()) {
      return [
        { label: 'Leave balance', value: bal?.totalAvailable ?? 0, caption: 'days available', icon: 'pi-calendar', tone: 'brand' },
        { label: 'Leave used', value: bal?.totalUsed ?? 0, caption: 'this year', icon: 'pi-calendar-minus', tone: 'amber' },
        { label: 'Pending requests', value: sum.pending, caption: 'awaiting approval', icon: 'pi-clock', tone: 'indigo' },
        { label: 'On leave today', value: sum.onLeaveToday, caption: sum.onLeaveToday ? "you're off today" : "you're working", icon: 'pi-user', tone: 'emerald' }
      ];
    }
    const isTeam = this.scope() === 'team';
    return [
      { label: isTeam ? 'My team' : 'Headcount', value: this.employees().length, caption: isTeam ? 'incl. you' : 'across Yugma', icon: 'pi-users', tone: 'brand' },
      { label: 'On leave today', value: sum.onLeaveToday, caption: 'approved today', icon: 'pi-calendar', tone: 'amber' },
      { label: 'Pending approvals', value: sum.pending, caption: 'require your action', icon: 'pi-clipboard', tone: 'indigo' },
      { label: 'Present today', value: att ? att.present + att.wfh + att.late : 0, caption: att ? `of ${att.total}` : '', icon: 'pi-check-circle', tone: 'emerald' }
    ];
  });

  // ── leave approve/reject (team leads & HR) ──
  decide(row: LeaveRow, action: 'approve' | 'reject'): void {
    this.busy.set(true);
    this.http.post(`${this.base}/hr/leave/${row.id}/${action}`, {}).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: action === 'approve' ? 'Approved' : 'Rejected', detail: `${row.employee} · ${row.type} leave` });
        this.busy.set(false);
        this.load();
      },
      error: () => { this.busy.set(false); this.toast.add({ severity: 'error', summary: 'Failed', detail: 'Could not update the request.' }); }
    });
  }

  leaveTone(status: string): StatusTone {
    return status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'cancelled' ? 'neutral' : 'warn';
  }

  // ── self attendance status (from my balance / leave today is approximate; use leave summary) ──
  myStatusLabel(): string { return this.leaveSummary().onLeaveToday ? 'On leave' : 'Working'; }
  myStatusIcon(): string { return this.leaveSummary().onLeaveToday ? 'pi-calendar' : 'pi-check-circle'; }
  myStatusClass(): string {
    return this.leaveSummary().onLeaveToday
      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300'
      : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  }

  // ── charts ──
  readonly deptChart = computed(() => {
    const counts = new Map<string, number>();
    for (const e of this.employees()) counts.set(e.department, (counts.get(e.department) ?? 0) + 1);
    const labels = [...counts.keys()].sort((a, b) => (counts.get(b)! - counts.get(a)!));
    return {
      labels,
      datasets: [{ label: 'Headcount', data: labels.map((l) => counts.get(l)!), backgroundColor: '#4361ff', borderRadius: 8, barThickness: 18 }]
    };
  });

  readonly myLeaveChart = computed(() => {
    const bt = this.myBalance()?.byType ?? [];
    return {
      labels: bt.map((t) => t.type),
      datasets: [{ data: bt.map((t) => t.used), backgroundColor: ['#4361ff', '#f59e0b', '#10b981', '#6366f1'], borderWidth: 0, hoverOffset: 4 }]
    };
  });

  readonly barOptions = computed(() => {
    const text = this.theme.isDark() ? '#cbd5e1' : '#475569';
    const grid = this.theme.isDark() ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: text }, grid: { color: 'transparent' } }, y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true } }
    };
  });
  readonly donutOptions = computed(() => {
    const text = this.theme.isDark() ? '#cbd5e1' : '#475569';
    return { maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'bottom', labels: { color: text, usePointStyle: true, boxWidth: 8 } } } };
  });

  // calendar helpers
  daysInMonth(): number[] {
    const last = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  leadingBlanks(): number[] {
    const offset = new Date(this.today.getFullYear(), this.today.getMonth(), 1).getDay();
    return Array.from({ length: offset }, (_, i) => i);
  }
}
