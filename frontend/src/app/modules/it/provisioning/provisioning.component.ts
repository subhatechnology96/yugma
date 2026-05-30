import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import {
  ProvisioningRequest,
  ProvisioningService,
  ProvisioningStatus
} from './provisioning.service';

type Filter = 'all' | ProvisioningStatus;

@Component({
  selector: 'app-provisioning',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    TitleCasePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TooltipModule,
    PageHeaderComponent,
    KpiCardComponent,
    StatusPillComponent,
    AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="IT &middot; Network"
      title="New user provisioning"
      subtitle="Open tickets when an employee joins. Create accounts, assign laptop and grant access."
    >
      <button pButton severity="secondary" [outlined]="true" icon="pi pi-refresh" label="Refresh" (click)="svc.refresh()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Pending"     [value]="svc.pendingCount()"     icon="pi-hourglass"        tone="amber"  caption="Waiting on IT" />
      <app-kpi-card label="In progress" [value]="svc.inProgressCount()"  icon="pi-spinner"          tone="brand"  caption="Being worked on" />
      <app-kpi-card label="Completed"   [value]="svc.completedCount()"   icon="pi-check-circle"     tone="emerald" caption="Provisioned" />
      <app-kpi-card label="Total"       [value]="svc.items().length"    icon="pi-server"            tone="rose"   caption="All-time" />
    </div>

    <!-- Filter bar -->
    <div class="card p-3 mb-4 flex items-center gap-2 flex-wrap">
      @for (f of filters; track f.value) {
        <button
          type="button"
          class="text-sm px-3 py-1.5 rounded-full transition border"
          [ngClass]="filter() === f.value
            ? 'bg-brand-600 text-white border-brand-600'
            : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:border-brand-300'"
          (click)="setFilter(f.value)"
        >
          <i class="pi {{ f.icon }} mr-1.5 text-[11px]"></i>
          {{ f.label }}
          <span class="ml-1.5 text-[11px] opacity-80">{{ countFor(f.value) }}</span>
        </button>
      }
      <div class="ml-auto text-xs text-surface-500">
        Auto-refresh disabled. Click Refresh to fetch latest.
      </div>
    </div>

    <!-- Tickets list -->
    <div class="space-y-3">
      @for (r of filtered(); track r.id) {
        <article
          class="card p-5 flex flex-col md:flex-row md:items-start gap-4 transition"
          [ngClass]="{
            'border-l-4 border-l-amber-400': r.status === 'pending',
            'border-l-4 border-l-brand-500': r.status === 'in_progress',
            'border-l-4 border-l-emerald-500 opacity-90': r.status === 'completed',
            'border-l-4 border-l-rose-500 opacity-80': r.status === 'rejected'
          }"
        >
          <app-avatar [name]="r.employeeName" size="lg" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-semibold leading-tight">{{ r.employeeName }}</h3>
              <app-status-pill [tone]="statusTone(r.status)">{{ statusLabel(r.status) }}</app-status-pill>
              <span class="text-xs text-surface-500">&middot; opened {{ r.requestedAt | date: 'medium' }}</span>
            </div>
            <div class="text-sm text-surface-600 dark:text-surface-300 mt-0.5">
              {{ r.designation }} &middot; {{ r.department }} &middot; {{ r.location }}
            </div>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div class="text-[10px] uppercase tracking-wider text-surface-500">Work email</div>
                <div class="font-mono text-xs mt-0.5 break-all">{{ r.email }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-surface-500">Assigned to</div>
                <div class="text-xs mt-0.5">{{ r.assignedTo || '—' }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-surface-500">Completed</div>
                <div class="text-xs mt-0.5">{{ r.completedAt ? (r.completedAt | date: 'medium') : '—' }}</div>
              </div>
            </div>
            @if (r.notes) {
              <div class="mt-3 text-xs text-surface-600 dark:text-surface-300 rounded-lg bg-surface-50 dark:bg-surface-950/40 border border-surface-200 dark:border-surface-800 p-2.5">
                <i class="pi pi-comment mr-1.5"></i>{{ r.notes }}
              </div>
            }
          </div>
          <div class="flex flex-col gap-2 shrink-0">
            <button pButton size="small" icon="pi pi-cog" label="Provision" (click)="openProvision(r)"></button>
            @if (r.status !== 'rejected') {
              <button pButton size="small" severity="secondary" [outlined]="true" icon="pi pi-times" label="Reject" (click)="quickReject(r)"></button>
            }
          </div>
        </article>
      }
      @if (svc.items().length === 0) {
        <div class="card p-10 text-center text-sm text-surface-500">
          <i class="pi pi-spin pi-spinner text-2xl"></i>
          <div class="mt-2">Loading tickets…</div>
        </div>
      }
      @if (svc.items().length && filtered().length === 0) {
        <div class="card p-10 text-center text-sm text-surface-500">
          No tickets match this filter.
        </div>
      }
    </div>

    <!-- Provision dialog -->
    <p-dialog
      [(visible)]="dialogOpen"
      [modal]="true"
      [draggable]="false"
      [closable]="true"
      [style]="{ width: '620px', 'max-width': '95vw' }"
      [showHeader]="false"
      [dismissableMask]="true"
    >
      @if (editing(); as r) {
        <div class="p-5">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <app-avatar [name]="r.employeeName" size="lg" />
              <div class="min-w-0">
                <div class="text-xs uppercase tracking-wider text-surface-500">Provision new user</div>
                <h3 class="font-semibold text-lg leading-tight truncate">{{ r.employeeName }}</h3>
                <div class="text-xs text-surface-500 truncate">{{ r.designation }} &middot; {{ r.department }} &middot; {{ r.location }}</div>
              </div>
            </div>
            <button pButton [text]="true" rounded icon="pi pi-times" (click)="dialogOpen = false"></button>
          </div>

          <div class="rounded-xl border border-brand-200 dark:border-brand-700/50 bg-brand-50/60 dark:bg-brand-500/10 p-4 mb-5">
            <div class="text-xs uppercase tracking-wider text-brand-700 dark:text-brand-300 font-semibold">Work email to create</div>
            <div class="font-mono text-base mt-1 break-all">{{ r.email }}</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Assigned IT engineer</label>
              <input pInputText [(ngModel)]="form.assignedTo" class="w-full !rounded-lg" placeholder="e.g. Vikram Singh" />
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Set status</label>
              <div class="flex gap-1.5 flex-wrap">
                @for (s of statusOptions; track s.value) {
                  <button
                    type="button"
                    class="text-xs px-3 py-1.5 rounded-lg border transition"
                    [ngClass]="form.status === s.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-200'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'"
                    (click)="form.status = s.value"
                  >
                    <i class="pi {{ s.icon }} mr-1.5 text-[11px]"></i>{{ s.label }}
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="mt-4">
            <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Provisioning notes</label>
            <textarea
              pTextarea
              [(ngModel)]="form.notes"
              rows="3"
              class="w-full !rounded-lg"
              placeholder="AD account created, laptop allocated #L-1124, VPN profile sent…"
            ></textarea>
          </div>

          <!-- Provisioning checklist -->
          <div class="mt-5">
            <div class="text-xs uppercase tracking-wider text-surface-500 mb-2">Recommended checklist</div>
            <ul class="space-y-1.5 text-sm text-surface-700 dark:text-surface-200">
              <li class="flex items-start gap-2"><i class="pi pi-check-square text-brand-500 text-xs mt-1"></i>Create AD / email account ({{ r.email }})</li>
              <li class="flex items-start gap-2"><i class="pi pi-check-square text-brand-500 text-xs mt-1"></i>Allocate laptop &amp; tag asset</li>
              <li class="flex items-start gap-2"><i class="pi pi-check-square text-brand-500 text-xs mt-1"></i>Add to {{ r.department }} security group</li>
              <li class="flex items-start gap-2"><i class="pi pi-check-square text-brand-500 text-xs mt-1"></i>Send VPN &amp; SSO onboarding email</li>
            </ul>
          </div>

          <div class="mt-5 flex items-center justify-end gap-2">
            <button pButton severity="secondary" [outlined]="true" label="Cancel" (click)="dialogOpen = false"></button>
            <button pButton icon="pi pi-check" label="Save ticket" [loading]="saving()" (click)="save()"></button>
          </div>
        </div>
      }
    </p-dialog>
  `
})
export class ProvisioningComponent {
  protected readonly svc = inject(ProvisioningService);
  private readonly messages = inject(MessageService);

  protected readonly filter = signal<Filter>('all');
  protected readonly filters: { label: string; value: Filter; icon: string }[] = [
    { label: 'All',          value: 'all',         icon: 'pi-list' },
    { label: 'Pending',      value: 'pending',     icon: 'pi-hourglass' },
    { label: 'In progress',  value: 'in_progress', icon: 'pi-spinner' },
    { label: 'Completed',    value: 'completed',   icon: 'pi-check-circle' },
    { label: 'Rejected',     value: 'rejected',    icon: 'pi-times-circle' }
  ];

  protected readonly statusOptions: { label: string; value: ProvisioningStatus; icon: string }[] = [
    { label: 'Pending',     value: 'pending',     icon: 'pi-hourglass' },
    { label: 'In progress', value: 'in_progress', icon: 'pi-spinner' },
    { label: 'Completed',   value: 'completed',   icon: 'pi-check' },
    { label: 'Rejected',    value: 'rejected',    icon: 'pi-times' }
  ];

  protected readonly editing = signal<ProvisioningRequest | null>(null);
  protected readonly saving = signal(false);
  protected dialogOpen = false;
  protected form: { status: ProvisioningStatus; assignedTo: string; notes: string } = {
    status: 'in_progress',
    assignedTo: '',
    notes: ''
  };

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const items = this.svc.items();
    return f === 'all' ? items : items.filter((r) => r.status === f);
  });

  constructor() {
    this.svc.refresh();
  }

  protected setFilter(v: Filter) {
    this.filter.set(v);
  }

  protected countFor(v: Filter) {
    if (v === 'all') return this.svc.items().length;
    return this.svc.items().filter((r) => r.status === v).length;
  }

  protected statusTone(s: ProvisioningStatus): 'success' | 'warn' | 'info' | 'neutral' | 'danger' {
    return ({
      pending: 'warn',
      in_progress: 'info',
      completed: 'success',
      rejected: 'danger'
    } as const)[s];
  }
  protected statusLabel(s: ProvisioningStatus) {
    return s === 'in_progress' ? 'In progress' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  protected openProvision(r: ProvisioningRequest) {
    this.editing.set(r);
    this.form = {
      status: r.status === 'pending' ? 'in_progress' : r.status,
      assignedTo: r.assignedTo ?? '',
      notes: r.notes ?? ''
    };
    this.dialogOpen = true;
  }

  protected quickReject(r: ProvisioningRequest) {
    this.svc.updateStatus(r.id, { status: 'rejected', notes: 'Rejected from list' }).subscribe({
      next: () =>
        this.messages.add({ severity: 'warn', summary: 'Ticket rejected', detail: r.employeeName }),
      error: () =>
        this.messages.add({ severity: 'error', summary: 'Update failed', detail: 'Try again.' })
    });
  }

  protected save() {
    const r = this.editing();
    if (!r) return;
    this.saving.set(true);
    this.svc
      .updateStatus(r.id, {
        status: this.form.status,
        assignedTo: this.form.assignedTo.trim() || null,
        notes: this.form.notes.trim() || null
      })
      .subscribe({
        next: (u) => {
          this.saving.set(false);
          this.dialogOpen = false;
          this.messages.add({
            severity: 'success',
            summary: 'Ticket updated',
            detail: `${u.employeeName} → ${this.statusLabel(u.status)}`
          });
        },
        error: () => {
          this.saving.set(false);
          this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Please try again.' });
        }
      });
  }
}
