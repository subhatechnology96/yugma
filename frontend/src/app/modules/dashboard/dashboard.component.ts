import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ThemeService } from '@core/services/theme.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    RouterLink,
    ChartModule,
    ButtonModule,
    TooltipModule,
    PageHeaderComponent,
    KpiCardComponent,
    StatusPillComponent,
    AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly today = new Date();
  readonly userName = computed(() => this.auth.user()?.fullName?.split(' ')[0] ?? 'there');

  // ── Mocked data — swap for service calls when the backend is wired ──
  readonly approvals = [
    { id: 'AP-7782', title: 'Purchase order #PO-7782', amount: '₹4,82,500', requester: 'Rohan Mehta', kind: 'PO' as const, age: '2h ago' },
    { id: 'AP-7783', title: 'Casual leave — 3 days', amount: '', requester: 'Sneha Iyer', kind: 'Leave' as const, age: '4h ago' },
    { id: 'AP-7784', title: 'Vendor onboarding · V-122', amount: '', requester: 'Ananya Rao', kind: 'Vendor' as const, age: '1d ago' },
    { id: 'AP-7785', title: 'Expense reimbursement', amount: '₹18,940', requester: 'Karthik Nair', kind: 'Expense' as const, age: '1d ago' }
  ];

  readonly activity = [
    { who: 'Priya Sharma', what: 'approved invoice INV-2026-0421', when: '12 min ago', tone: 'success' as const, icon: 'pi-check-circle' },
    { who: 'System', what: 'generated payroll cycle MAY-2026', when: '1h ago', tone: 'info' as const, icon: 'pi-cog' },
    { who: 'Rohan Mehta', what: 'created PO #PO-7782 for ₹4.82 L', when: '2h ago', tone: 'info' as const, icon: 'pi-file-plus' },
    { who: 'Sneha Iyer', what: 'applied for casual leave (3 days)', when: '4h ago', tone: 'warn' as const, icon: 'pi-calendar' },
    { who: 'AI Assistant', what: 'flagged anomaly: receivables aging > 90 days', when: 'Today', tone: 'danger' as const, icon: 'pi-sparkles' }
  ];

  readonly aiInsights = [
    { title: 'Receivables risk', body: '7 invoices totalling ₹21.4 L are >60 days overdue. Auto-generate dunning letters?', cta: 'Review', tone: 'rose' as const, icon: 'pi-exclamation-triangle' },
    { title: 'Hiring forecast', body: 'You’ll be 12 FTEs short for Q3 plan at current attrition. Engineering most exposed.', cta: 'See plan', tone: 'indigo' as const, icon: 'pi-chart-line' },
    { title: 'Cash savings', body: 'Switching Vendor V-014 → V-027 on MAT-019x saves est. ₹3.6 L/quarter.', cta: 'Apply', tone: 'emerald' as const, icon: 'pi-bolt' }
  ];

  readonly calendarEvents = [
    { day: 19, label: 'Q1 close review', time: '10:00', tone: 'info' as const },
    { day: 20, label: 'Hiring panel — SR ENG', time: '14:30', tone: 'warn' as const },
    { day: 22, label: 'Payroll cutoff', time: 'EOD', tone: 'danger' as const },
    { day: 26, label: 'Board KPI deck due', time: '09:00', tone: 'info' as const }
  ];

  // ── Charts ──
  readonly revenueChart = computed(() => this.buildRevenueChart(this.theme.isDark()));
  readonly employeeChart = computed(() => this.buildEmployeeChart(this.theme.isDark()));
  readonly inventoryChart = computed(() => this.buildInventoryChart(this.theme.isDark()));

  readonly chartOptions = computed(() => this.buildChartOptions(this.theme.isDark()));
  readonly barOptions = computed(() => this.buildBarOptions(this.theme.isDark()));
  readonly donutOptions = computed(() => this.buildDonutOptions(this.theme.isDark()));

  approvalIcon(kind: 'PO' | 'Leave' | 'Vendor' | 'Expense') {
    return { PO: 'pi-file', Leave: 'pi-calendar', Vendor: 'pi-truck', Expense: 'pi-wallet' }[kind];
  }

  approvalTone(kind: 'PO' | 'Leave' | 'Vendor' | 'Expense') {
    return { PO: 'brand', Leave: 'amber', Vendor: 'indigo', Expense: 'emerald' }[kind] as
      | 'brand'
      | 'amber'
      | 'indigo'
      | 'emerald';
  }

  // Day-grid helpers
  daysInMonth(): number[] {
    const y = this.today.getFullYear();
    const m = this.today.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  leadingBlanks(): number[] {
    const offset = new Date(this.today.getFullYear(), this.today.getMonth(), 1).getDay();
    return Array.from({ length: offset }, (_, i) => i);
  }
  eventForDay(d: number) {
    return this.calendarEvents.find((e) => e.day === d);
  }

  // ─────────────────────────── chart builders ───────────────────────────
  private buildRevenueChart(dark: boolean) {
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Revenue',
          data: [42, 48, 51, 55, 62, 68, 72, 78, 74, 80, 86, 92],
          fill: true,
          tension: 0.45,
          borderColor: '#4361ff',
          backgroundColor: this.gradientFor('#4361ff'),
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2
        },
        {
          label: 'Expenses',
          data: [30, 33, 35, 38, 41, 45, 47, 51, 50, 53, 56, 59],
          fill: true,
          tension: 0.45,
          borderColor: '#10b981',
          backgroundColor: this.gradientFor('#10b981'),
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2
        }
      ]
    };
  }

  private buildEmployeeChart(_dark: boolean) {
    return {
      labels: ['Engineering', 'Sales', 'CS', 'Finance', 'HR', 'Ops'],
      datasets: [
        { label: 'Headcount', data: [86, 42, 28, 18, 12, 24], backgroundColor: '#4361ff', borderRadius: 8, barThickness: 22 },
        { label: 'Open roles', data: [12, 4, 3, 1, 0, 2], backgroundColor: '#a5b4fc', borderRadius: 8, barThickness: 22 }
      ]
    };
  }

  private buildInventoryChart(_dark: boolean) {
    return {
      labels: ['Healthy stock', 'Low stock', 'Out of stock', 'Excess'],
      datasets: [
        {
          data: [62, 22, 6, 10],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6366f1'],
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    };
  }

  private buildChartOptions(dark: boolean) {
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { mode: 'index', intersect: false }
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: text }, grid: { color: 'transparent' } },
        y: { ticks: { color: text }, grid: { color: grid } }
      }
    };
  }
  private buildBarOptions(dark: boolean) {
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: text, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { ticks: { color: text }, grid: { color: 'transparent' } },
        y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true }
      }
    };
  }
  private buildDonutOptions(dark: boolean) {
    const text = dark ? '#cbd5e1' : '#475569';
    return {
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { color: text, usePointStyle: true, boxWidth: 8 } } }
    };
  }

  private gradientFor(hex: string) {
    if (typeof document === 'undefined') return hex + '20';
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return hex + '20';
    const g = ctx.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, hex + '55');
    g.addColorStop(1, hex + '00');
    return g;
  }
}
