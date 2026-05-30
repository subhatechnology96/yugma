import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { ThemeService } from '@core/services/theme.service';
import { EmployeeService } from '../services/employee.service';

@Component({
  selector: 'app-hr-analytics',
  standalone: true,
  imports: [ChartModule, PageHeaderComponent, KpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="HR · Insights" title="HR analytics" subtitle="Attrition, diversity, headcount and compensation trends."></app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Attrition (TTM)" [value]="7.4" suffix="%" format="1.1-1" icon="pi-arrow-down" tone="rose" [delta]="-1.2" trend="down" />
      <app-kpi-card label="Tenure avg." [value]="4.2" suffix=" yrs" format="1.1-1" icon="pi-clock" tone="brand" />
      <app-kpi-card label="Gender ratio" [value]="46" suffix="%" caption="female workforce" icon="pi-users" tone="indigo" />
      <app-kpi-card label="Compa-ratio" [value]="1.02" format="1.2-2" icon="pi-percentage" tone="emerald" />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="section-title">Headcount trend</div>
        <div class="text-lg font-semibold mt-1 mb-4">Last 12 months</div>
        <div class="h-[280px]"><p-chart type="line" [data]="trend()" [options]="lineOpts()" /></div>
      </div>
      <div class="card p-5">
        <div class="section-title">Department share</div>
        <div class="text-lg font-semibold mt-1 mb-4">By active employees</div>
        <div class="h-[280px]"><p-chart type="doughnut" [data]="byDept()" [options]="donutOpts()" /></div>
      </div>
    </div>
  `
})
export class HrAnalyticsComponent {
  private readonly theme = inject(ThemeService);
  private readonly svc = inject(EmployeeService);

  trend = computed(() => ({
    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Headcount',
        data: [210, 215, 222, 226, 229, 232, 236, 238, 241, 244, 246, 248],
        borderColor: '#4361ff',
        backgroundColor: 'rgba(67,97,255,0.10)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }
    ]
  }));

  byDept = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.svc.all()) map.set(e.department, (map.get(e.department) ?? 0) + 1);
    return {
      labels: Array.from(map.keys()),
      datasets: [
        {
          data: Array.from(map.values()),
          backgroundColor: ['#4361ff', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#a855f7'],
          borderWidth: 0
        }
      ]
    };
  });

  lineOpts = computed(() => this.makeOpts(false));
  donutOpts = computed(() => ({ ...this.makeOpts(true), cutout: '64%' }));

  private makeOpts(donut: boolean) {
    const dark = this.theme.isDark();
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: text, usePointStyle: true, boxWidth: 8 } } },
      ...(donut
        ? {}
        : {
            scales: {
              x: { ticks: { color: text }, grid: { color: 'transparent' } },
              y: { ticks: { color: text }, grid: { color: grid } }
            }
          })
    };
  }
}
