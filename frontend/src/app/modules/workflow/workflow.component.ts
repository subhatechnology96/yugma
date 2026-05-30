import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';

interface Stage {
  label: string;
  approver: string;
  status: 'done' | 'current' | 'pending';
}

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [NgClass, ButtonModule, PageHeaderComponent, KpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Automation" title="Workflows" subtitle="Multi-level approvals, dynamic rules and SLA-aware routing.">
      <button pButton severity="secondary" outlined icon="pi pi-list" label="Templates"></button>
      <button pButton icon="pi pi-plus" label="New workflow"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Active workflows" [value]="32" icon="pi-sitemap" tone="brand" />
      <app-kpi-card label="Pending approvals" [value]="14" icon="pi-hourglass" tone="amber" />
      <app-kpi-card label="SLA breaches" [value]="2" icon="pi-flag" tone="rose" />
      <app-kpi-card label="Auto-routed (MTD)" [value]="186" caption="No human action" icon="pi-bolt" tone="emerald" />
    </div>

    <div class="card p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="section-title">Active flow · Purchase Order Approval</div>
          <div class="text-lg font-semibold mt-1">PO-7782 · ₹4.82 L · raised by Rohan Mehta</div>
        </div>
        <div class="flex gap-2">
          <button pButton severity="secondary" outlined icon="pi pi-pencil" label="Edit flow"></button>
          <button pButton severity="danger" outlined icon="pi pi-ban" label="Reject"></button>
          <button pButton icon="pi pi-check" label="Approve"></button>
        </div>
      </div>

      <ol class="flex flex-col md:flex-row md:items-center gap-3 md:gap-1">
        @for (s of stages; track s.label; let i = $index, last = $last) {
          <li class="flex md:flex-col items-center md:items-stretch md:flex-1 gap-3">
            <div class="flex md:flex-row items-center gap-2 md:gap-3">
              <span class="w-9 h-9 rounded-full grid place-items-center font-semibold text-sm shrink-0"
                [ngClass]="{
                  'bg-emerald-500 text-white': s.status === 'done',
                  'bg-brand-600 text-white ring-4 ring-brand-200 dark:ring-brand-500/30': s.status === 'current',
                  'bg-surface-200 dark:bg-surface-800 text-surface-500': s.status === 'pending'
                }">
                @if (s.status === 'done') { <i class="pi pi-check"></i> } @else { {{ i + 1 }} }
              </span>
              @if (!last) {
                <span class="hidden md:block flex-1 h-0.5 bg-surface-200 dark:bg-surface-800"></span>
              }
            </div>
            <div class="md:mt-2">
              <div class="text-sm font-semibold">{{ s.label }}</div>
              <div class="text-xs text-surface-500">{{ s.approver }}</div>
            </div>
          </li>
        }
      </ol>
    </div>
  `
})
export class WorkflowComponent {
  protected readonly stages: Stage[] = [
    { label: 'Requestor', approver: 'Rohan Mehta', status: 'done' },
    { label: 'Manager approval', approver: 'Vikram Singh', status: 'done' },
    { label: 'Finance review', approver: 'Meera Krishnan', status: 'current' },
    { label: 'CFO approval', approver: 'Aarav Verma', status: 'pending' },
    { label: 'Vendor notification', approver: 'Auto', status: 'pending' }
  ];
}
