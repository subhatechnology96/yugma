import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ServicesService } from '../services.service';
import { ServiceOrder, ServiceSummary, SERVICE_STAGES, SERVICE_TYPE_META, ServiceType } from '../models';

@Component({
  selector: 'app-services-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Services" title="Services overview" subtitle="Delivery across Project, Field Service, Helpdesk and Appointments — one pipeline, tracked end to end.">
      <a routerLink="/services/pipeline"><button pButton severity="secondary" outlined icon="pi pi-sitemap" label="Open pipeline"></button></a>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[26px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <!-- Service areas -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
      @for (a of areas(); track a.route) {
        <a [routerLink]="a.route" class="card p-4 flex items-center gap-3 hover:border-surface-300 dark:hover:border-surface-700 transition group">
          <span class="w-10 h-10 rounded-xl grid place-items-center bg-surface-100 dark:bg-surface-800 text-surface-500 group-hover:text-brand-600 transition"><i class="pi {{ a.icon }}"></i></span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-surface-800 dark:text-surface-100">{{ a.label }}</div>
            <div class="text-[11px] text-surface-400">{{ a.caption }}</div>
          </div>
          <span class="text-lg font-semibold tabular-nums text-surface-700 dark:text-surface-200">{{ a.value }}</span>
        </a>
      }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Pipeline by stage -->
      <div class="card p-4">
        <div class="section-title mb-3">Pipeline by stage</div>
        <div class="space-y-2.5">
          @for (f of funnel(); track f.label) {
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-medium text-surface-700 dark:text-surface-200 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full" [class]="f.dot"></span>{{ f.label }}</span>
                <span class="text-surface-500 tabular-nums">{{ f.count }}</span>
              </div>
              <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <div class="h-full rounded-full bg-brand-500" [style.width.%]="f.pct"></div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Recent orders -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="section-title">Recent orders</div>
          <a routerLink="/services/pipeline" class="text-xs text-brand-600 hover:underline">View all</a>
        </div>
        <div class="divide-y divide-surface-100 dark:divide-surface-800">
          @for (o of recent(); track o.id) {
            <a [routerLink]="['/services/pipeline']" class="flex items-center gap-3 py-2.5">
              <span class="w-7 h-7 rounded-lg grid place-items-center bg-surface-100 dark:bg-surface-800 text-surface-400 text-xs"><i class="pi {{ meta[o.type].icon }} text-[11px]"></i></span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{{ o.title }}</div>
                <div class="text-[11px] text-surface-400 truncate">{{ o.code }} · {{ o.customer }} · {{ o.assignedTo || 'Unassigned' }}</div>
              </div>
              <span class="text-[11px] text-surface-400">{{ stageLabel(o.stage) }}</span>
            </a>
          }
          @if (!recent().length) { <div class="text-xs text-surface-400 py-4 text-center">No orders yet.</div> }
        </div>
      </div>
    </div>
  `
})
export class ServicesDashboardComponent {
  private readonly svc = inject(ServicesService);
  protected readonly meta = SERVICE_TYPE_META;

  protected readonly summary = signal<ServiceSummary | null>(null);
  protected readonly recent = signal<ServiceOrder[]>([]);

  constructor() {
    this.svc.summary().subscribe((s) => this.summary.set(s));
    this.svc.orders().subscribe((o) => this.recent.set(o.slice(0, 6)));
  }

  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Total orders', value: s?.totalOrders ?? 0, caption: 'all service work', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Open', value: s?.open ?? 0, caption: 'active right now', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Overdue', value: s?.overdue ?? 0, caption: 'need attention', tone: (s?.overdue ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100' },
      { label: 'Hours logged', value: (s?.loggedHours ?? 0).toFixed(1), caption: 'tracked time', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  protected readonly areas = computed(() => {
    const s = this.summary();
    const count = (t: ServiceType) => s?.byType.find((x) => x.type === t)?.open ?? 0;
    return [
      { label: 'Project', icon: 'pi-folder', route: '/services/project', caption: 'projects & deliveries', value: count('Project') },
      { label: 'Field Service', icon: 'pi-truck', route: '/services/field-service', caption: 'on-site jobs', value: count('FieldService') },
      { label: 'Helpdesk', icon: 'pi-comments', route: '/services/helpdesk', caption: 'support tickets', value: count('Helpdesk') },
      { label: 'Appointments', icon: 'pi-calendar-plus', route: '/services/appointments', caption: 'scheduled meetings', value: count('Appointment') },
      { label: 'Timesheets', icon: 'pi-clock', route: '/services/timesheets', caption: 'logged hours', value: (s?.loggedHours ?? 0).toFixed(0) },
      { label: 'Planning', icon: 'pi-calendar', route: '/services/planning', caption: 'scheduled work', value: s?.funnel.scheduled ?? 0 }
    ];
  });

  protected readonly funnel = computed(() => {
    const f = this.summary()?.funnel;
    if (!f) return [];
    const vals: Record<string, number> = { new: f.new, scheduled: f.scheduled, inprogress: f.inProgress, review: f.review, done: f.done, cancelled: f.cancelled };
    const max = Math.max(...Object.values(vals), 1);
    return SERVICE_STAGES.map((s) => ({ label: s.label, dot: s.dot, count: vals[s.key] ?? 0, pct: Math.round(((vals[s.key] ?? 0) / max) * 100) }));
  });

  stageLabel(s: string): string { return SERVICE_STAGES.find((x) => x.key === s)?.label ?? s; }
}
