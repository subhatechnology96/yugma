import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { CrmService } from '../services/crm.service';

@Component({
  selector: 'app-contacts-list',
  standalone: true,
  imports: [RouterLink, TableModule, InputTextModule, ButtonModule, PageHeaderComponent, AvatarComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM" title="Contacts" subtitle="People across your accounts.">
      <button pButton icon="pi pi-plus" label="Add contact"></button>
    </app-page-header>

    <div class="card">
      <div class="p-4 border-b border-surface-200 dark:border-surface-800">
        <input pInputText type="text" placeholder="Search contacts…" (input)="dt.filterGlobal($any($event.target).value, 'contains')" class="!h-9 w-64" />
      </div>
      <p-table #dt [value]="crm.contacts()" [paginator]="true" [rows]="10" [globalFilterFields]="['fullName', 'email', 'accountName', 'title']" responsiveLayout="scroll" [rowHover]="true">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase" pSortableColumn="fullName">Name</th>
            <th class="!text-xs !uppercase">Title</th>
            <th class="!text-xs !uppercase" pSortableColumn="accountName">Account</th>
            <th class="!text-xs !uppercase">Email</th>
            <th class="!text-xs !uppercase">Phone</th>
            <th class="!text-xs !uppercase">Owner</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-c>
          <tr>
            <td>
              <div class="flex items-center gap-2">
                <app-avatar [name]="c.fullName" size="sm" />
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{{ c.fullName }}</span>
                  @if (c.isPrimary) { <app-status-pill tone="info">Primary</app-status-pill> }
                </div>
              </div>
            </td>
            <td class="text-sm">{{ c.title || '—' }}</td>
            <td class="text-sm"><a [routerLink]="['/crm/accounts', c.accountId]" class="text-brand-600 hover:underline">{{ c.accountName }}</a></td>
            <td class="text-sm">{{ c.email }}</td>
            <td class="text-sm tabular-nums">{{ c.phone }}</td>
            <td class="text-sm">{{ c.owner }}</td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class ContactsListComponent {
  protected readonly crm = inject(CrmService);
  constructor() {
    this.crm.loadContacts();
  }
}
