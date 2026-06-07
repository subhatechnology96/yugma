import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ServicesService } from '../services.service';
import { TimesheetReport, SERVICE_TYPE_META } from '../models';

@Component({
  selector: 'app-services-timesheets',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TableModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Services" title="Timesheets" subtitle="Time logged against every service order — by person and by day." />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- By person -->
      <div class="card p-4 lg:col-span-1 self-start">
        <div class="flex items-center justify-between mb-3">
          <div class="section-title">Hours by person</div>
          <span class="text-sm font-semibold tabular-nums">{{ report()?.totalHours ?? 0 | number: '1.0-1' }}h</span>
        </div>
        <div class="space-y-2.5">
          @for (p of report()?.byPerson ?? []; track p.person) {
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-medium text-surface-700 dark:text-surface-200">{{ p.person }}</span>
                <span class="text-surface-500 tabular-nums">{{ p.hours | number: '1.0-1' }}h · {{ p.entries }}</span>
              </div>
              <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <div class="h-full rounded-full bg-brand-500" [style.width.%]="pct(p.hours)"></div>
              </div>
            </div>
          }
          @if (!(report()?.byPerson ?? []).length) { <div class="text-xs text-surface-400">No time logged yet.</div> }
        </div>
      </div>

      <!-- Entries -->
      <div class="card lg:col-span-2 overflow-hidden">
        <p-table [value]="report()?.entries ?? []" responsiveLayout="scroll" [rowHover]="true" [paginator]="(report()?.entries?.length ?? 0) > 12" [rows]="12" class="p-1">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!text-xs !uppercase !text-surface-500">Date</th>
              <th class="!text-xs !uppercase !text-surface-500">Order</th>
              <th class="!text-xs !uppercase !text-surface-500">Person</th>
              <th class="!text-xs !uppercase !text-surface-500 !text-right">Hours</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-e>
            <tr>
              <td class="text-sm text-surface-500 whitespace-nowrap">{{ e.date | date: 'mediumDate' }}</td>
              <td>
                <div class="text-sm font-medium flex items-center gap-1.5">
                  @if (e.type) { <i class="pi {{ typeIcon(e.type) }} text-[10px] text-surface-400"></i> }
                  <span class="truncate">{{ e.title }}</span>
                </div>
                <div class="text-[11px] text-surface-400">{{ e.code }} · {{ e.customer }}@if (e.note) { · {{ e.note }} }</div>
              </td>
              <td class="text-sm">{{ e.person }}</td>
              <td class="text-right tabular-nums font-medium">{{ e.hours | number: '1.0-1' }}h</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="4" class="py-10 text-center text-surface-500">No time entries yet.</td></tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `
})
export class TimesheetsComponent {
  private readonly svc = inject(ServicesService);
  protected readonly meta = SERVICE_TYPE_META;
  protected readonly report = signal<TimesheetReport | null>(null);

  constructor() { this.svc.timesheets().subscribe((r) => this.report.set(r)); }

  pct(hours: number): number {
    const max = Math.max(...(this.report()?.byPerson ?? []).map((p) => p.hours), 1);
    return Math.round((hours / max) * 100);
  }

  typeIcon(type?: string): string {
    return (SERVICE_TYPE_META as Record<string, { icon: string }>)[type ?? '']?.icon ?? 'pi-circle';
  }
}
