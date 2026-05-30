import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';

@Component({
  selector: 'app-crm-quotes',
  standalone: true,
  imports: [RouterLink, ButtonModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM" title="Quotes" subtitle="Quotes are managed in the Sales module and link back to CRM deals."></app-page-header>

    <div class="card p-10 text-center max-w-xl mx-auto">
      <span class="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 grid place-items-center mx-auto">
        <i class="pi pi-file-edit text-2xl"></i>
      </span>
      <h2 class="text-lg font-semibold mt-4">Quoting lives in Sales</h2>
      <p class="text-sm text-surface-500 dark:text-surface-400 mt-2">
        Generate, send and track quotes from the Sales module. Each quote is associated with a CRM deal so
        the pipeline stays in sync. Use Reports for quote-to-close analytics.
      </p>
      <div class="flex items-center justify-center gap-2 mt-6">
        <button pButton routerLink="/reports" label="Open Sales / Reports" icon="pi pi-external-link"></button>
        <button pButton severity="secondary" outlined routerLink="/crm/deals" label="Back to pipeline"></button>
      </div>
    </div>
  `
})
export class CrmQuotesComponent {}
