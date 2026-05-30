import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-crm-dashboard',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, ChartModule, ButtonModule, PageHeaderComponent, KpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crm-dashboard.component.html'
})
export class CrmDashboardComponent {
  private readonly theme = inject(ThemeService);
  readonly today = new Date();

  // ── Mocked data — swap for service calls when the backend is wired ──
  readonly aiInsights = [
    { title: 'At-risk deals', body: '3 deals worth ₹38.1 L have had no activity in 14+ days. Schedule follow-ups before they slip.', cta: 'Review deals', tone: 'rose' as const, icon: 'pi-exclamation-triangle' },
    { title: 'Hot leads to prioritise', body: 'Rahul Saxena (CRED, score 91) and Ananya Desai (PhonePe, score 88) are showing strong intent.', cta: 'View leads', tone: 'indigo' as const, icon: 'pi-bolt' },
    { title: 'Quarter forecast', body: 'Weighted pipeline projects ₹2.4 Cr closing this quarter — 86% of the ₹2.8 Cr target.', cta: 'See forecast', tone: 'emerald' as const, icon: 'pi-chart-line' }
  ];

  readonly upcoming = [
    { day: 29, label: 'Discovery call — Reliance POS', time: '10:30', tone: 'info' as const },
    { day: 30, label: 'Demo — Tata Digital', time: '14:00', tone: 'warn' as const },
    { day: 31, label: 'Send pricing — Flipkart Health+', time: 'EOD', tone: 'info' as const },
    { day: 2, label: 'Security questionnaire — Infosys', time: '09:00', tone: 'danger' as const }
  ];

  // ── Charts ──
  readonly pipelineChart = computed(() => this.buildPipelineChart(this.theme.isDark()));
  readonly wonVsTargetChart = computed(() => this.buildWonVsTargetChart(this.theme.isDark()));
  readonly barOptions = computed(() => this.buildBarOptions(this.theme.isDark()));
  readonly areaOptions = computed(() => this.buildAreaOptions(this.theme.isDark()));

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
    return this.upcoming.find((e) => e.day === d);
  }

  private buildPipelineChart(_dark: boolean) {
    // Funnel by stage — open pipeline value (₹ lakh) per stage.
    return {
      labels: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'],
      datasets: [
        {
          label: 'Pipeline value (₹ L)',
          data: [175, 240, 449, 387, 42],
          backgroundColor: ['#94b1ff', '#6987ff', '#4361ff', '#2f44e6', '#10b981'],
          borderRadius: 8,
          barThickness: 30
        }
      ]
    };
  }

  private buildWonVsTargetChart(dark: boolean) {
    return {
      labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        {
          label: 'Won (₹ L)',
          data: [38, 44, 41, 52, 48, 61, 67, 59, 72, 78, 71, 84],
          fill: true,
          tension: 0.45,
          borderColor: '#4361ff',
          backgroundColor: this.gradientFor('#4361ff'),
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2
        },
        {
          label: 'Target (₹ L)',
          data: [45, 45, 50, 55, 55, 60, 65, 65, 70, 75, 80, 85],
          fill: false,
          tension: 0.45,
          borderColor: '#94a3b8',
          borderDash: [5, 4],
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    };
  }

  private buildBarOptions(dark: boolean) {
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: text }, grid: { color: 'transparent' } },
        y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true }
      }
    };
  }

  private buildAreaOptions(dark: boolean) {
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
