import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChartModule } from 'primeng/chart';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-crm-analytics',
  standalone: true,
  imports: [ChartModule, PageHeaderComponent, KpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM" title="CRM Analytics" subtitle="Pipeline conversion, source mix and rep performance."></app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Win rate" [value]="32" suffix="%" icon="pi-trophy" tone="emerald" [delta]="3.4" trend="up" />
      <app-kpi-card label="Avg. deal size" [value]="9.4" prefix="₹" suffix=" L" format="1.1-1" icon="pi-indian-rupee" tone="brand" [delta]="5.1" trend="up" />
      <app-kpi-card label="Sales cycle" [value]="38" suffix=" days" icon="pi-clock" tone="indigo" [delta]="-4.0" trend="down" />
      <app-kpi-card label="Lead → SQL" [value]="46" suffix="%" icon="pi-filter" tone="amber" [delta]="1.8" trend="up" />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="section-title">Conversion</div>
        <div class="text-lg font-semibold mt-1 mb-4">Deals by stage</div>
        <div class="h-[260px]"><p-chart type="bar" [data]="stageChart()" [options]="barOptions()" /></div>
      </div>
      <div class="card p-5">
        <div class="section-title">Acquisition</div>
        <div class="text-lg font-semibold mt-1 mb-4">Leads by source</div>
        <div class="h-[260px]"><p-chart type="doughnut" [data]="sourceChart()" [options]="donutOptions()" /></div>
      </div>
      <div class="card p-5">
        <div class="section-title">Team</div>
        <div class="text-lg font-semibold mt-1 mb-4">Won value by rep (₹ L)</div>
        <div class="h-[260px]"><p-chart type="bar" [data]="repChart()" [options]="barOptions()" /></div>
      </div>
      <div class="card p-5">
        <div class="section-title">Trend</div>
        <div class="text-lg font-semibold mt-1 mb-4">Won revenue — last 6 months (₹ L)</div>
        <div class="h-[260px]"><p-chart type="line" [data]="trendChart()" [options]="lineOptions()" /></div>
      </div>
    </div>
  `
})
export class CrmAnalyticsComponent {
  private readonly theme = inject(ThemeService);

  readonly stageChart = computed(() => ({
    labels: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
    datasets: [{ label: 'Deals', data: [2, 2, 3, 3, 2, 1], backgroundColor: ['#94b1ff', '#6987ff', '#4361ff', '#2f44e6', '#10b981', '#ef4444'], borderRadius: 8, barThickness: 28 }]
  }));

  readonly sourceChart = computed(() => ({
    labels: ['Inbound', 'Website', 'Referral', 'Event', 'Campaign', 'Cold call', 'Partner'],
    datasets: [{ data: [4, 2, 2, 2, 1, 1, 1], backgroundColor: ['#4361ff', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#94a3b8', '#06b6d4'], borderWidth: 0, hoverOffset: 4 }]
  }));

  readonly repChart = computed(() => ({
    labels: ['Vikram Singh', 'Meera Krishnan', 'Arjun Trivedi'],
    datasets: [{ label: 'Won (₹ L)', data: [42, 38, 24], backgroundColor: '#4361ff', borderRadius: 8, barThickness: 30 }]
  }));

  readonly trendChart = computed(() => ({
    labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{ label: 'Won (₹ L)', data: [59, 62, 72, 78, 71, 84], fill: false, tension: 0.45, borderColor: '#4361ff', pointRadius: 0, borderWidth: 2 }]
  }));

  readonly barOptions = computed(() => this.base(this.theme.isDark(), false));
  readonly lineOptions = computed(() => this.base(this.theme.isDark(), false));
  readonly donutOptions = computed(() => {
    const text = this.theme.isDark() ? '#cbd5e1' : '#475569';
    return { maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'right', labels: { color: text, usePointStyle: true, boxWidth: 8 } } } };
  });

  private base(dark: boolean, legend: boolean) {
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: { legend: { display: legend, labels: { color: text } } },
      scales: {
        x: { ticks: { color: text }, grid: { color: 'transparent' } },
        y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true }
      }
    };
  }
}
