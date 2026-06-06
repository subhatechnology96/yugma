import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ApprovalFlowComponent } from '@shared/components/approval-flow/approval-flow.component';
import { MyRequestsService } from './my-requests.service';
import { MyRequest, RequestStatus } from './my-requests.models';

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [
    DatePipe,
    ButtonModule,
    PageHeaderComponent,
    StatusPillComponent,
    EmptyStateComponent,
    ApprovalFlowComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="My Work"
      title="My Requests"
      subtitle="Track only your own requests and see exactly where each one sits in the approval flow.">
      <button pButton severity="secondary" outlined icon="pi pi-refresh" label="Refresh" (click)="svc.load()"></button>
    </app-page-header>

    <!-- Filter chips -->
    <div class="mb-4 flex flex-wrap gap-2">
      @for (f of filters; track f.key) {
        <button
          type="button"
          (click)="filter.set(f.key)"
          class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition"
          [class]="filter() === f.key
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
            : 'border-surface-200 text-surface-600 hover:bg-surface-100 dark:border-surface-800 dark:text-surface-400 dark:hover:bg-surface-800'">
          {{ f.label }}
          <span class="rounded-full bg-surface-100 px-1.5 text-xs font-semibold text-surface-500 dark:bg-surface-800">{{ counts()[f.key] }}</span>
        </button>
      }
    </div>

    @if (svc.loading()) {
      <div class="card grid place-items-center p-12 text-surface-500">
        <i class="pi pi-spin pi-spinner text-2xl"></i>
        <span class="mt-3 text-sm">Loading your requests…</span>
      </div>
    } @else if (svc.error()) {
      <div class="card p-6">
        <app-empty-state icon="pi-exclamation-triangle" title="Something went wrong" [description]="svc.error()!">
          <button pButton icon="pi pi-refresh" label="Try again" (click)="svc.load()"></button>
        </app-empty-state>
      </div>
    } @else if (svc.requests().length === 0) {
      <div class="card p-6">
        <app-empty-state
          icon="pi-inbox"
          title="No requests yet"
          description="When you raise a leave request it will appear here with its full approval flow." />
      </div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <!-- Request list -->
        <div class="flex flex-col gap-3">
          @for (r of filtered(); track r.id) {
            <button
              type="button"
              (click)="selected.set(r)"
              class="card w-full p-4 text-left transition hover:border-brand-200 dark:hover:border-brand-500/40"
              [class]="selected()?.id === r.id ? 'ring-2 ring-brand-300 dark:ring-brand-500/40' : ''">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    <i class="pi {{ r.icon }}"></i>
                  </span>
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold">{{ r.title }}</div>
                    <div class="truncate text-xs text-surface-500">{{ r.subtitle }}</div>
                  </div>
                </div>
                <app-status-pill [tone]="tone(r.status)">{{ statusLabel(r.status) }}</app-status-pill>
              </div>
              <div class="mt-3 flex items-center justify-between text-xs text-surface-500">
                <span>Submitted {{ r.submittedOn | date: 'd MMM y' }}</span>
                @if (r.pendingWith) {
                  <span class="font-medium text-amber-600 dark:text-amber-400">
                    <i class="pi pi-hourglass mr-1"></i>With {{ r.pendingWith }}
                  </span>
                }
              </div>
            </button>
          }
        </div>

        <!-- Detail + approval flow -->
        <div class="card self-start p-5 lg:sticky lg:top-4">
          @if (selected(); as r) {
            <div class="mb-4 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs uppercase tracking-wide text-surface-400">{{ r.typeLabel }}</div>
                <div class="mt-0.5 text-lg font-semibold">{{ r.title }}</div>
                <div class="text-sm text-surface-500">{{ r.subtitle }}</div>
              </div>
              <app-status-pill [tone]="tone(r.status)">{{ statusLabel(r.status) }}</app-status-pill>
            </div>

            @if (r.summary) {
              <div class="mb-5 rounded-xl bg-surface-50 p-3 text-sm text-surface-600 dark:bg-surface-800/50 dark:text-surface-300">
                {{ r.summary }}
              </div>
            }

            <div class="mb-3 flex items-center justify-between">
              <div class="section-title">Approval flow</div>
              @if (r.pendingWith) {
                <span class="text-xs font-medium text-amber-600 dark:text-amber-400">Pending with {{ r.pendingWith }}</span>
              }
            </div>
            <app-approval-flow [steps]="r.steps" />

            <p class="mt-4 border-t border-surface-100 pt-3 text-xs text-surface-400 dark:border-surface-800">
              Leave is decided by your reporting manager. Higher levels show your escalation line for visibility.
            </p>
          } @else {
            <app-empty-state icon="pi-arrow-left" title="Select a request" description="Pick a request on the left to see its approval flow." />
          }
        </div>
      </div>
    }
  `
})
export class MyRequestsComponent {
  protected readonly svc = inject(MyRequestsService);

  protected readonly filter = signal<Filter>('all');
  protected readonly selected = signal<MyRequest | null>(null);

  protected readonly filters: ReadonlyArray<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' }
  ];

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.svc.requests();
    return f === 'all' ? list : list.filter((r) => r.status === f);
  });

  protected readonly counts = computed(() => {
    const list = this.svc.requests();
    return {
      all: list.length,
      pending: list.filter((r) => r.status === 'pending').length,
      approved: list.filter((r) => r.status === 'approved').length,
      rejected: list.filter((r) => r.status === 'rejected').length
    };
  });

  constructor() {
    this.svc.load();
    // Keep a valid selection as the list loads or changes, without re-triggering on selection writes.
    effect(() => {
      const list = this.svc.requests();
      untracked(() => {
        const cur = this.selected();
        if (!cur || !list.some((r) => r.id === cur.id)) {
          this.selected.set(list[0] ?? null);
        }
      });
    });
  }

  protected tone(status: RequestStatus): StatusTone {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warn';
      case 'rejected':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected statusLabel(status: RequestStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
