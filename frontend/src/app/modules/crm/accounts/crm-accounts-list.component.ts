import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { CrmService } from '../services/crm.service';
import { AccountStatus } from '../models/crm.models';

@Component({
  selector: 'app-crm-accounts-list',
  standalone: true,
  imports: [TitleCasePipe, TableModule, InputTextModule, ButtonModule, PageHeaderComponent, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM" title="Accounts" subtitle="Companies you sell to.">
      <button pButton icon="pi pi-plus" label="Add account"></button>
    </app-page-header>

    <div class="card">
      <div class="p-4 border-b border-surface-200 dark:border-surface-800">
        <input pInputText type="text" placeholder="Search accounts…" (input)="dt.filterGlobal($any($event.target).value, 'contains')" class="!h-9 w-64" />
      </div>
      <p-table #dt [value]="crm.accounts()" [paginator]="true" [rows]="10" [globalFilterFields]="['name', 'industry', 'owner']" responsiveLayout="scroll" [rowHover]="true">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase" pSortableColumn="name">Account</th>
            <th class="!text-xs !uppercase">Industry</th>
            <th class="!text-xs !uppercase">Size</th>
            <th class="!text-xs !uppercase" pSortableColumn="annualRevenue">Annual revenue</th>
            <th class="!text-xs !uppercase">Owner</th>
            <th class="!text-xs !uppercase">Status</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-a>
          <tr class="cursor-pointer" (click)="open(a.id)">
            <td class="font-medium">{{ a.name }}</td>
            <td class="text-sm">{{ a.industry || '—' }}</td>
            <td class="text-sm">{{ a.size || '—' }}</td>
            <td class="text-sm tabular-nums font-semibold">{{ a.annualRevenue | inr: 'compact' }}</td>
            <td class="text-sm">{{ a.owner }}</td>
            <td><app-status-pill [tone]="tone(a.status)">{{ a.status | titlecase }}</app-status-pill></td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class CrmAccountsListComponent {
  protected readonly crm = inject(CrmService);
  private readonly router = inject(Router);
  constructor() {
    this.crm.loadAccounts();
  }
  open(id: string) {
    this.router.navigate(['/crm/accounts', id]);
  }
  tone(s: AccountStatus): 'success' | 'warn' | 'neutral' {
    return s === 'customer' ? 'success' : s === 'churned' ? 'warn' : 'neutral';
  }
}
