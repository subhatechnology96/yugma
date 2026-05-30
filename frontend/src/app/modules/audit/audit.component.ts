import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';

interface AuditRow { at: string; who: string; action: string; resource: string; ip: string; outcome: 'success' | 'failed'; }

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, TableModule, ButtonModule, PageHeaderComponent, StatusPillComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Security" title="Audit logs" subtitle="Tamper-proof activity trail. Searchable, exportable, retained for 7 years.">
      <button pButton severity="secondary" outlined icon="pi pi-download" label="Export"></button>
      <button pButton icon="pi pi-search" label="Search"></button>
    </app-page-header>

    <div class="card">
      <p-table [value]="logs()" responsiveLayout="scroll" [rowHover]="true">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase">When</th>
            <th class="!text-xs !uppercase">Actor</th>
            <th class="!text-xs !uppercase">Action</th>
            <th class="!text-xs !uppercase">Resource</th>
            <th class="!text-xs !uppercase">IP / device</th>
            <th class="!text-xs !uppercase">Outcome</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-l>
          <tr>
            <td class="font-mono text-xs">{{ l.at | date: 'medium' }}</td>
            <td>
              <div class="flex items-center gap-2">
                <app-avatar [name]="l.who" size="xs" />
                <span class="font-medium">{{ l.who }}</span>
              </div>
            </td>
            <td class="font-mono text-xs">{{ l.action }}</td>
            <td class="text-sm text-surface-500">{{ l.resource }}</td>
            <td class="font-mono text-xs text-surface-500">{{ l.ip }}</td>
            <td>
              <app-status-pill [tone]="l.outcome === 'success' ? 'success' : 'danger'">{{ l.outcome | titlecase }}</app-status-pill>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class AuditComponent {
  private readonly http = inject(HttpClient);
  protected readonly logs = signal<AuditRow[]>([]);
  constructor() {
    this.http.get<AuditRow[]>(`${environment.apiBaseUrl}/audit`).subscribe((r) => this.logs.set(r));
  }
}
