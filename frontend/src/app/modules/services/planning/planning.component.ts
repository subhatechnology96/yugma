import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ServicesService } from '../services.service';
import { ServiceOrder, SERVICE_TYPE_META, SERVICE_STAGES } from '../models';

@Component({
  selector: 'app-services-planning',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Services" title="Planning" subtitle="Scheduled service work on the calendar — grouped by day, in time order." />

    <div class="card p-4">
      @if (groups().length) {
        <div class="space-y-5">
          @for (g of groups(); track g.key) {
            <div>
              <div class="flex items-center gap-2 mb-2">
                <div class="text-[13px] font-semibold text-surface-700 dark:text-surface-200">{{ g.label }}</div>
                <span class="text-xs text-surface-400">{{ g.items.length }} scheduled</span>
                @if (g.isToday) { <span class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">Today</span> }
              </div>
              <div class="space-y-2 border-l-2 border-surface-100 dark:border-surface-800 pl-3">
                @for (o of g.items; track o.id) {
                  <a [routerLink]="['/services/pipeline']" class="flex items-center gap-3 rounded-lg border border-surface-200/70 dark:border-surface-800 p-2.5 hover:border-surface-300 dark:hover:border-surface-700 transition">
                    <span class="text-xs tabular-nums text-surface-500 w-16 shrink-0">{{ o.scheduledAt | date: 'h:mm a' }}</span>
                    <span class="w-7 h-7 rounded-lg grid place-items-center bg-surface-100 dark:bg-surface-800 text-surface-400 shrink-0"><i class="pi {{ meta[o.type].icon }} text-[11px]"></i></span>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{{ o.title }}</div>
                      <div class="text-[11px] text-surface-400 truncate">{{ o.customer }} · {{ o.assignedTo || 'Unassigned' }}</div>
                    </div>
                    <span class="text-[11px] text-surface-400 shrink-0">{{ stageLabel(o.stage) }}</span>
                  </a>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="text-center text-sm text-surface-400 py-12">Nothing scheduled. Assign a date to orders from the pipeline to see them here.</div>
      }
    </div>
  `
})
export class PlanningComponent {
  private readonly svc = inject(ServicesService);
  protected readonly meta = SERVICE_TYPE_META;
  protected readonly orders = signal<ServiceOrder[]>([]);

  constructor() { this.svc.planning().subscribe((o) => this.orders.set(o)); }

  protected readonly groups = computed(() => {
    const todayKey = new Date().toDateString();
    const map = new Map<string, { key: string; label: string; isToday: boolean; sort: number; items: ServiceOrder[] }>();
    for (const o of this.orders()) {
      if (!o.scheduledAt) continue;
      const d = new Date(o.scheduledAt);
      const key = d.toDateString();
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
          isToday: key === todayKey,
          sort: d.getTime(),
          items: []
        });
      }
      map.get(key)!.items.push(o);
    }
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  });

  stageLabel(s: string): string { return SERVICE_STAGES.find((x) => x.key === s)?.label ?? s; }
}
