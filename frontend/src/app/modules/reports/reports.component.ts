import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';

interface Report {
  title: string;
  description: string;
  icon: string;
  tone: 'brand' | 'emerald' | 'amber' | 'indigo' | 'rose';
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ButtonModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Insights" title="Reports & analytics" subtitle="Real-time dashboards with drill-down. Export to Excel or PDF.">
      <button pButton severity="secondary" outlined icon="pi pi-file-pdf" label="Schedule"></button>
      <button pButton icon="pi pi-plus" label="New report"></button>
    </app-page-header>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      @for (r of reports; track r.title) {
        <div class="card p-5 hover:border-brand-300 dark:hover:border-brand-700 cursor-pointer transition">
          <div class="flex items-start gap-4">
            <span class="w-11 h-11 rounded-xl grid place-items-center shrink-0"
              [class.bg-brand-50]="r.tone === 'brand'" [class.text-brand-600]="r.tone === 'brand'"
              [class.bg-emerald-50]="r.tone === 'emerald'" [class.text-emerald-600]="r.tone === 'emerald'"
              [class.bg-amber-50]="r.tone === 'amber'" [class.text-amber-600]="r.tone === 'amber'"
              [class.bg-indigo-50]="r.tone === 'indigo'" [class.text-indigo-600]="r.tone === 'indigo'"
              [class.bg-rose-50]="r.tone === 'rose'" [class.text-rose-600]="r.tone === 'rose'">
              <i class="pi {{ r.icon }} text-lg"></i>
            </span>
            <div>
              <div class="font-semibold">{{ r.title }}</div>
              <div class="text-sm text-surface-500 mt-1">{{ r.description }}</div>
              <div class="mt-3 flex gap-2">
                <button pButton size="small" label="Open"></button>
                <button pButton size="small" severity="secondary" outlined icon="pi pi-download" label="Export"></button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ReportsComponent {
  protected readonly reports: Report[] = [
    { title: 'Revenue by region', description: 'Quarter-over-quarter revenue with currency normalization.', icon: 'pi-map', tone: 'brand' },
    { title: 'Customer cohort retention', description: 'Monthly cohorts with month-12 retention curve.', icon: 'pi-users', tone: 'indigo' },
    { title: 'Aged receivables', description: 'Buckets 0-30, 31-60, 61-90, 90+ days by customer.', icon: 'pi-inbox', tone: 'rose' },
    { title: 'Vendor performance', description: 'On-time-in-full, quality and price variance.', icon: 'pi-truck', tone: 'emerald' },
    { title: 'Attrition by tenure', description: 'Voluntary attrition cohorts segmented by tenure bands.', icon: 'pi-chart-line', tone: 'amber' },
    { title: 'GST liability summary', description: 'Output and input GST with reconciliation status.', icon: 'pi-percentage', tone: 'indigo' }
  ];
}
