import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import {
  BillingCycle,
  ModuleSubscription,
  SubPlan,
  SubStatus,
  SubscriptionService
} from './subscription.service';

interface Section {
  title: string;
  description: string;
  icon: string;
}

interface PlanOption {
  label: string;
  value: SubPlan;
  /** indicative monthly price suggestion */
  monthly: number;
  /** marketing blurb */
  tagline: string;
}

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    TitleCasePipe,
    UpperCasePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    InputNumberModule,
    ToggleSwitchModule,
    TooltipModule,
    PageHeaderComponent,
    StatusPillComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="Admin"
      title="Configuration"
      subtitle="Tenant-wide settings, integrations, custom fields and policies."
    ></app-page-header>

    <!-- =================== Operations subscriptions =================== -->
    <section class="mb-10">
      <div class="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div class="section-title">Operations</div>
          <h2 class="text-xl font-semibold tracking-tight mt-1">Subscription modules</h2>
          <p class="text-sm text-surface-500 mt-1 max-w-2xl">
            Choose which operational suites are active for your workspace. Upgrade plans, adjust seat counts and review renewal dates without leaving the console.
          </p>
        </div>
        <div class="text-right">
          <div class="text-xs text-surface-500 uppercase tracking-wider">Total committed</div>
          <div class="text-2xl font-semibold tabular-nums">
            ₹{{ totalMonthly() | number: '1.0-0' }}
            <span class="text-sm text-surface-500 font-normal">/ mo</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        @for (s of svc.items(); track s.id) {
          <article
            class="relative flex flex-col rounded-2xl border bg-white dark:bg-surface-900 overflow-hidden transition shadow-card"
            [ngClass]="{
              'border-brand-300 dark:border-brand-600': s.status === 'active',
              'border-amber-300 dark:border-amber-700': s.status === 'trialing',
              'border-surface-200 dark:border-surface-800 opacity-80': s.status === 'paused' || s.status === 'cancelled'
            }"
          >
            <!-- Plan ribbon -->
            <div class="absolute top-4 right-4 flex items-center gap-2">
              <span
                class="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-md"
                [ngClass]="planRibbon(s.plan)"
              >{{ s.plan | titlecase }}</span>
            </div>

            <!-- Header -->
            <div class="p-5 pb-3">
              <div class="flex items-center gap-3">
                <span
                  class="w-12 h-12 rounded-2xl grid place-items-center"
                  [ngClass]="iconBubble(s.moduleKey)"
                >
                  <i class="pi {{ s.icon }} text-xl"></i>
                </span>
                <div class="min-w-0">
                  <div class="font-semibold leading-tight truncate">{{ s.moduleName }}</div>
                  <div class="text-xs text-surface-500 mt-0.5">{{ s.moduleKey | uppercase }}</div>
                </div>
              </div>
              <p class="mt-3 text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{{ s.description }}</p>
            </div>

            <!-- Price -->
            <div class="px-5">
              <div class="flex items-baseline gap-2">
                <span class="text-3xl font-semibold tabular-nums">₹{{ s.monthlyPrice | number: '1.0-0' }}</span>
                <span class="text-sm text-surface-500">/ {{ s.billingCycle === 'annual' ? 'mo, billed yearly' : 'month' }}</span>
              </div>
              <div class="text-xs text-surface-500 mt-1 flex items-center gap-1">
                <i class="pi pi-refresh text-[10px]"></i>
                Renews on {{ s.renewsAt | date: 'mediumDate' }}
              </div>
            </div>

            <!-- Seats -->
            <div class="px-5 mt-4">
              <div class="flex items-center justify-between text-xs">
                <span class="text-surface-500">Seats</span>
                <span class="tabular-nums font-medium">{{ s.seatsUsed }} / {{ s.seats }}</span>
              </div>
              <div class="mt-1.5 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <div
                  class="h-full rounded-full"
                  [ngClass]="seatBar(s)"
                  [style.width.%]="seatPct(s)"
                ></div>
              </div>
            </div>

            <!-- Features -->
            <ul class="px-5 mt-4 space-y-1.5 flex-1">
              @for (f of s.features; track f) {
                <li class="text-sm text-surface-700 dark:text-surface-200 flex items-start gap-2">
                  <i class="pi pi-check text-emerald-500 text-xs mt-1 shrink-0"></i>
                  <span>{{ f }}</span>
                </li>
              }
            </ul>

            <!-- Footer -->
            <div class="mt-5 px-5 py-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between gap-3 bg-surface-50/60 dark:bg-surface-950/40">
              <app-status-pill [tone]="statusTone(s.status)">{{ s.status | titlecase }}</app-status-pill>
              <div class="flex items-center gap-2">
                <p-toggleswitch
                  [ngModel]="s.status === 'active' || s.status === 'trialing'"
                  (ngModelChange)="onToggle(s, $event)"
                  pTooltip="Pause or resume this module"
                  tooltipPosition="top"
                />
                <button
                  pButton
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  icon="pi pi-pencil"
                  label="Manage"
                  (click)="openEdit(s)"
                ></button>
              </div>
            </div>
          </article>
        }
        @if (svc.items().length === 0) {
          <div class="lg:col-span-3 card p-10 text-center">
            <i class="pi pi-spin pi-spinner text-3xl text-surface-400"></i>
            <div class="mt-3 text-sm text-surface-500">Loading subscriptions…</div>
          </div>
        }
      </div>
    </section>

    <!-- =================== Other admin tiles =================== -->
    <section>
      <div class="section-title mb-3">General</div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        @for (s of sections; track s.title) {
          <div class="card p-5 hover:border-brand-300 dark:hover:border-brand-700 transition cursor-pointer">
            <span class="w-11 h-11 rounded-xl grid place-items-center bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 mb-3">
              <i class="pi {{ s.icon }} text-lg"></i>
            </span>
            <div class="font-semibold">{{ s.title }}</div>
            <div class="text-sm text-surface-500 mt-1">{{ s.description }}</div>
            <button pButton [text]="true" class="!px-0 mt-2" label="Configure →"></button>
          </div>
        }
      </div>
    </section>

    <!-- =================== Manage subscription dialog =================== -->
    <p-dialog
      [(visible)]="editOpen"
      [modal]="true"
      [draggable]="false"
      [closable]="true"
      [style]="{ width: '560px', 'max-width': '95vw' }"
      [showHeader]="false"
      [dismissableMask]="true"
    >
      @if (editing(); as sub) {
        <div class="p-5">
          <div class="flex items-start justify-between gap-4 mb-1">
            <div class="flex items-center gap-3 min-w-0">
              <span
                class="w-11 h-11 rounded-2xl grid place-items-center shrink-0"
                [ngClass]="iconBubble(sub.moduleKey)"
              >
                <i class="pi {{ sub.icon }}"></i>
              </span>
              <div class="min-w-0">
                <div class="text-xs uppercase tracking-wider text-surface-500">Manage subscription</div>
                <h3 class="font-semibold text-lg leading-tight truncate">{{ sub.moduleName }}</h3>
              </div>
            </div>
            <button pButton [text]="true" rounded icon="pi pi-times" (click)="editOpen = false"></button>
          </div>

          <p class="text-sm text-surface-500 mt-1 mb-5">{{ sub.description }}</p>

          <!-- Plan selection -->
          <div class="mb-5">
            <div class="text-xs uppercase tracking-wider text-surface-500 mb-2">Plan</div>
            <div class="grid grid-cols-3 gap-2">
              @for (p of planOptions; track p.value) {
                <button
                  type="button"
                  class="text-left p-3 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-brand-300"
                  [ngClass]="form.plan === p.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 ring-1 ring-brand-300/40'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'"
                  (click)="selectPlan(p)"
                >
                  <div class="text-sm font-semibold">{{ p.label }}</div>
                  <div class="text-xs text-surface-500 mt-0.5 leading-snug">{{ p.tagline }}</div>
                  <div class="text-xs mt-2 tabular-nums">
                    <span class="font-semibold">₹{{ p.monthly | number: '1.0-0' }}</span>
                    <span class="text-surface-500"> / mo</span>
                  </div>
                </button>
              }
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Billing cycle</label>
              <p-select
                [options]="cycleOptions"
                [(ngModel)]="form.billingCycle"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
              />
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Status</label>
              <p-select
                [options]="statusOptions"
                [(ngModel)]="form.status"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
              />
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Seats</label>
              <p-inputNumber
                [(ngModel)]="form.seats"
                [min]="sub.seatsUsed"
                [step]="5"
                [showButtons]="true"
                buttonLayout="horizontal"
                spinnerMode="horizontal"
                inputStyleClass="!rounded-lg text-right"
                styleClass="w-full"
                decrementButtonClass="p-button-secondary"
                incrementButtonClass="p-button-secondary"
              />
              <div class="text-[11px] text-surface-500 mt-1">Minimum {{ sub.seatsUsed }} (currently in use)</div>
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Monthly price (₹)</label>
              <p-inputNumber
                [(ngModel)]="form.monthlyPrice"
                [min]="0"
                [step]="500"
                inputStyleClass="!rounded-lg text-right tabular-nums"
                styleClass="w-full"
              />
            </div>
          </div>

          <div class="mt-5 p-3 rounded-xl bg-surface-50 dark:bg-surface-950/40 border border-surface-200 dark:border-surface-800 text-xs text-surface-600 dark:text-surface-300 flex items-start gap-2">
            <i class="pi pi-info-circle mt-0.5"></i>
            <span>
              Changes apply from the next billing cycle ({{ sub.renewsAt | date: 'mediumDate' }}). Seat reductions cannot go below users currently assigned to the module.
            </span>
          </div>

          <div class="mt-5 flex items-center justify-end gap-2">
            <button pButton severity="secondary" [outlined]="true" label="Cancel" (click)="editOpen = false"></button>
            <button pButton icon="pi pi-check" label="Save changes" [loading]="saving()" (click)="save()"></button>
          </div>
        </div>
      }
    </p-dialog>
  `
})
export class ConfigurationComponent {
  protected readonly svc = inject(SubscriptionService);
  private readonly messages = inject(MessageService);

  protected readonly sections: Section[] = [
    { title: 'Organisation profile', description: 'Legal name, GSTIN, billing address, logo.', icon: 'pi-building' },
    { title: 'Custom fields', description: 'Extend HR, Accounts and Material entities with tenant-specific fields.', icon: 'pi-pencil' },
    { title: 'Approval policies', description: 'Threshold-based and multi-level approval matrices.', icon: 'pi-shield' },
    { title: 'Integrations', description: 'Slack, Microsoft Teams, Tally, Zoho, SAP, Salesforce.', icon: 'pi-link' },
    { title: 'Webhooks', description: 'Outbound webhooks on entity events.', icon: 'pi-globe' },
    { title: 'API keys', description: 'Manage service tokens with scoped permissions.', icon: 'pi-key' }
  ];

  protected readonly planOptions: PlanOption[] = [
    { label: 'Starter',    value: 'starter',    monthly: 9999,  tagline: 'For small teams getting started.' },
    { label: 'Growth',     value: 'growth',     monthly: 24999, tagline: 'For scaling teams across regions.' },
    { label: 'Enterprise', value: 'enterprise', monthly: 49999, tagline: 'Premium SLA, SSO and audit.' }
  ];
  protected readonly cycleOptions = [
    { label: 'Monthly', value: 'monthly' as BillingCycle },
    { label: 'Annual (save ~15%)', value: 'annual' as BillingCycle }
  ];
  protected readonly statusOptions = [
    { label: 'Active', value: 'active' as SubStatus },
    { label: 'Trialing', value: 'trialing' as SubStatus },
    { label: 'Paused', value: 'paused' as SubStatus },
    { label: 'Cancelled', value: 'cancelled' as SubStatus }
  ];

  protected editOpen = false;
  protected readonly editing = signal<ModuleSubscription | null>(null);
  protected readonly saving = signal(false);
  protected form = {
    plan: 'growth' as SubPlan,
    status: 'active' as SubStatus,
    billingCycle: 'monthly' as BillingCycle,
    seats: 0,
    monthlyPrice: 0
  };

  constructor() {
    this.svc.refresh();
  }

  protected totalMonthly() {
    return this.svc
      .items()
      .filter((s) => s.status === 'active' || s.status === 'trialing')
      .reduce((sum, s) => sum + (s.monthlyPrice || 0), 0);
  }

  protected seatPct(s: ModuleSubscription) {
    if (!s.seats) return 0;
    return Math.min(100, Math.round((s.seatsUsed / s.seats) * 100));
  }
  protected seatBar(s: ModuleSubscription) {
    const pct = this.seatPct(s);
    if (pct >= 90) return 'bg-rose-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-brand-500';
  }

  protected planRibbon(plan: SubPlan): string {
    return {
      starter:    'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200',
      growth:     'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
      enterprise: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
    }[plan];
  }

  protected iconBubble(moduleKey: string): string {
    return ({
      hr:        'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300',
      accounts:  'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      material:  'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300'
    } as Record<string, string>)[moduleKey] ?? 'bg-surface-100 dark:bg-surface-800 text-surface-600';
  }

  protected statusTone(status: SubStatus): 'success' | 'warn' | 'info' | 'neutral' | 'danger' {
    return ({
      active: 'success',
      trialing: 'info',
      paused: 'warn',
      cancelled: 'danger'
    } as const)[status];
  }

  protected openEdit(sub: ModuleSubscription) {
    this.editing.set(sub);
    this.form = {
      plan: sub.plan,
      status: sub.status,
      billingCycle: sub.billingCycle,
      seats: sub.seats,
      monthlyPrice: sub.monthlyPrice
    };
    this.editOpen = true;
  }

  protected selectPlan(p: PlanOption) {
    this.form.plan = p.value;
    // If the current price is the suggested price of another plan, switch to the new plan's suggestion.
    const isSuggestedPrice = this.planOptions.some((opt) => opt.monthly === this.form.monthlyPrice);
    if (isSuggestedPrice) this.form.monthlyPrice = p.monthly;
  }

  protected onToggle(sub: ModuleSubscription, enabled: boolean) {
    const nextStatus: SubStatus = enabled
      ? (sub.status === 'trialing' ? 'trialing' : 'active')
      : 'paused';
    if (nextStatus === sub.status) return;
    this.svc
      .update(sub.id, {
        plan: sub.plan,
        status: nextStatus,
        billingCycle: sub.billingCycle,
        monthlyPrice: sub.monthlyPrice,
        seats: sub.seats
      })
      .subscribe({
        next: () =>
          this.messages.add({
            severity: enabled ? 'success' : 'warn',
            summary: enabled ? 'Module resumed' : 'Module paused',
            detail: `${sub.moduleName} is now ${nextStatus}.`
          }),
        error: () =>
          this.messages.add({ severity: 'error', summary: 'Update failed', detail: 'Could not update subscription.' })
      });
  }

  protected save() {
    const sub = this.editing();
    if (!sub) return;
    this.saving.set(true);
    this.svc
      .update(sub.id, {
        plan: this.form.plan,
        status: this.form.status,
        billingCycle: this.form.billingCycle,
        monthlyPrice: this.form.monthlyPrice,
        seats: this.form.seats
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editOpen = false;
          this.messages.add({
            severity: 'success',
            summary: 'Subscription updated',
            detail: `${sub.moduleName} → ${this.form.plan} / ${this.form.billingCycle}.`
          });
        },
        error: () => {
          this.saving.set(false);
          this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Please try again.' });
        }
      });
  }
}
