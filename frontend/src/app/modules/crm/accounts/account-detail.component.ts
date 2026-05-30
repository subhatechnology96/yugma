import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { CrmService } from '../services/crm.service';
import { DealService } from '../services/deal.service';
import { Activity } from '../models/crm.models';

type Tab = 'activities' | 'deals' | 'quotes' | 'notes';
interface TimelineEntry { kind: 'activity' | 'note'; date: string; title: string; detail: string; icon: string; }

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, FormsModule, RouterLink, ButtonModule, InputTextModule, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (account(); as a) {
      <a routerLink="/crm/accounts" class="text-xs font-medium text-brand-600 hover:underline"><i class="pi pi-arrow-left text-[10px]"></i> All accounts</a>

      <!-- Profile header -->
      <div class="card p-5 mt-3">
        <div class="flex flex-wrap items-start gap-4">
          <span class="w-14 h-14 rounded-2xl bg-brand-600 text-white grid place-items-center text-xl font-bold shrink-0">{{ initials(a.name) }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-xl font-semibold tracking-tight">{{ a.name }}</h1>
              <app-status-pill [tone]="statusTone(a.status)">{{ a.status | titlecase }}</app-status-pill>
            </div>
            <div class="text-sm text-surface-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span><i class="pi pi-briefcase text-[11px] mr-1"></i>{{ a.industry || '—' }}</span>
              <span><i class="pi pi-user text-[11px] mr-1"></i>{{ a.owner }}</span>
              @if (a.website) { <span><i class="pi pi-globe text-[11px] mr-1"></i>{{ a.website }}</span> }
              @if (a.phone) { <span><i class="pi pi-phone text-[11px] mr-1"></i>{{ a.phone }}</span> }
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-surface-500 uppercase tracking-wider">Annual revenue</div>
            <div class="text-2xl font-semibold tracking-tight">{{ a.annualRevenue | inr: 'compact' }}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-surface-200 dark:border-surface-800">
          <div><div class="text-xs text-surface-500">Open deals</div><div class="text-lg font-semibold">{{ openDeals().length }}</div></div>
          <div><div class="text-xs text-surface-500">Pipeline value</div><div class="text-lg font-semibold">{{ pipelineValue() | inr: 'compact' }}</div></div>
          <div><div class="text-xs text-surface-500">Contacts</div><div class="text-lg font-semibold">{{ contacts().length }}</div></div>
          <div><div class="text-xs text-surface-500">Open activities</div><div class="text-lg font-semibold">{{ openActivities().length }}</div></div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <!-- Tabs -->
        <div class="card p-0 xl:col-span-2 overflow-hidden">
          <div class="flex border-b border-surface-200 dark:border-surface-800 px-2">
            @for (t of tabs; track t.key) {
              <button type="button" (click)="tab.set(t.key)"
                class="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition"
                [class.border-brand-600]="tab() === t.key" [class.text-brand-600]="tab() === t.key"
                [class.border-transparent]="tab() !== t.key" [class.text-surface-500]="tab() !== t.key">
                {{ t.label }}
                <span class="ml-1 text-xs text-surface-400">{{ t.count() }}</span>
              </button>
            }
          </div>

          <div class="p-5">
            @switch (tab()) {
              @case ('activities') {
                @for (act of accountActivities(); track act.id) {
                  <div class="flex items-center gap-3 py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                    <span class="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 grid place-items-center text-surface-600"><i class="pi {{ typeIcon(act.type) }} text-sm"></i></span>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate" [class.line-through]="act.status === 'done'" [class.text-surface-400]="act.status === 'done'">{{ act.subject }}</div>
                      <div class="text-xs text-surface-500">{{ act.dueAt | date: 'MMM d, h:mm a' }} · {{ act.owner }}</div>
                    </div>
                    @if (act.status === 'open') {
                      <button pButton size="small" text icon="pi pi-check" pTooltip="Mark done" (click)="markDone(act)"></button>
                    } @else { <app-status-pill tone="success">Done</app-status-pill> }
                  </div>
                } @empty { <div class="text-sm text-surface-500 py-6 text-center">No activities yet.</div> }
              }
              @case ('deals') {
                @for (d of accountDeals(); track d.id) {
                  <div class="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                    <div class="min-w-0"><div class="text-sm font-medium truncate">{{ d.name }}</div><div class="text-xs text-surface-500">{{ d.stageName }} · closes {{ d.closeDate | date: 'MMM d' }}</div></div>
                    <div class="text-sm font-semibold text-brand-600 tabular-nums">{{ d.value | inr: 'compact' }}</div>
                  </div>
                } @empty { <div class="text-sm text-surface-500 py-6 text-center">No deals yet.</div> }
              }
              @case ('quotes') {
                <div class="text-sm text-surface-500 py-6 text-center">Quotes are managed in the Sales module. <a routerLink="/reports" class="text-brand-600 hover:underline">Open Sales</a>.</div>
              }
              @case ('notes') {
                <div class="flex gap-2 mb-4">
                  <input pInputText [(ngModel)]="noteDraft" placeholder="Add a note…" class="flex-1 !h-9" />
                  <button pButton label="Add" [disabled]="!noteDraft.trim()" (click)="addNote()"></button>
                </div>
                @for (n of accountNotes(); track n.id) {
                  <div class="py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                    <div class="text-sm">{{ n.body }}</div>
                    <div class="text-xs text-surface-500 mt-0.5">{{ n.author }} · {{ n.createdAt | date: 'MMM d, y' }}</div>
                  </div>
                } @empty { <div class="text-sm text-surface-500 py-6 text-center">No notes yet.</div> }
              }
            }
          </div>
        </div>

        <!-- Interaction timeline -->
        <div class="card p-5">
          <div class="section-title mb-3">Interaction timeline</div>
          @if (timeline().length) {
            <ol class="relative ml-2 border-l border-surface-200 dark:border-surface-800 space-y-4 pl-4">
              @for (e of timeline(); track $index) {
                <li class="relative">
                  <span class="absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full grid place-items-center bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                    <i class="pi {{ e.icon }} text-[8px]"></i>
                  </span>
                  <div class="text-sm font-medium">{{ e.title }}</div>
                  <div class="text-xs text-surface-500">{{ e.detail }}</div>
                  <div class="text-[11px] text-surface-400 mt-0.5">{{ e.date | date: 'MMM d, y · h:mm a' }}</div>
                </li>
              }
            </ol>
          } @else {
            <div class="text-sm text-surface-500 py-6 text-center">No interactions recorded.</div>
          }
        </div>
      </div>
    } @else {
      <div class="card p-10 text-center text-surface-500">Account not found. <a routerLink="/crm/accounts" class="text-brand-600 hover:underline">Back to accounts</a>.</div>
    }
  `
})
export class AccountDetailComponent {
  readonly id = input.required<string>();
  protected readonly crm = inject(CrmService);
  private readonly dealSvc = inject(DealService);

  noteDraft = '';
  readonly tab = signal<Tab>('activities');

  readonly account = computed(() => this.crm.accounts().find((a) => a.id === this.id()));
  readonly contacts = computed(() => this.crm.contactsForAccount(this.id()));
  readonly accountDeals = computed(() => this.dealSvc.deals().filter((d) => d.accountId === this.id()));
  readonly openDeals = computed(() => this.accountDeals().filter((d) => d.status === 'open'));
  readonly pipelineValue = computed(() => this.openDeals().reduce((s, d) => s + d.value, 0));

  readonly accountActivities = computed(() => {
    const dealIds = new Set(this.accountDeals().map((d) => d.id));
    return this.crm.activities()
      .filter((a) => (a.relatedToType === 'account' && a.relatedToId === this.id()) || (a.relatedToType === 'deal' && dealIds.has(a.relatedToId)))
      .sort((a, b) => +new Date(b.dueAt) - +new Date(a.dueAt));
  });
  readonly openActivities = computed(() => this.accountActivities().filter((a) => a.status === 'open'));

  readonly accountNotes = computed(() => {
    const dealIds = new Set(this.accountDeals().map((d) => d.id));
    return this.crm.notes()
      .filter((n) => (n.relatedToType === 'account' && n.relatedToId === this.id()) || (n.relatedToType === 'deal' && dealIds.has(n.relatedToId)))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  });

  readonly timeline = computed<TimelineEntry[]>(() => {
    const acts: TimelineEntry[] = this.accountActivities().map((a) => ({ kind: 'activity', date: a.dueAt, title: a.subject, detail: `${a.type} · ${a.owner}`, icon: this.typeIcon(a.type) }));
    const notes: TimelineEntry[] = this.accountNotes().map((n) => ({ kind: 'note', date: n.createdAt, title: 'Note added', detail: `${n.body.slice(0, 60)}${n.body.length > 60 ? '…' : ''}`, icon: 'pi-comment' }));
    return [...acts, ...notes].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 12);
  });

  readonly tabs = [
    { key: 'activities' as Tab, label: 'Activities', count: () => this.accountActivities().length },
    { key: 'deals' as Tab, label: 'Deals', count: () => this.accountDeals().length },
    { key: 'quotes' as Tab, label: 'Quotes', count: () => 0 },
    { key: 'notes' as Tab, label: 'Notes', count: () => this.accountNotes().length }
  ];

  constructor() {
    this.crm.loadAccounts();
    this.crm.loadContacts();
    this.crm.loadActivities();
    this.crm.loadNotes();
    this.dealSvc.load();
  }

  markDone(a: Activity) {
    this.crm.markActivityDone(a.id).subscribe();
  }

  addNote() {
    const body = this.noteDraft.trim();
    if (!body) return;
    this.crm.createNote(body, 'account', this.id(), 'Priya Sharma').subscribe();
    this.noteDraft = '';
  }

  typeIcon(type: string): string {
    return { call: 'pi-phone', email: 'pi-envelope', meeting: 'pi-users', task: 'pi-check-square' }[type] ?? 'pi-circle';
  }
  statusTone(s: string): StatusTone {
    return s === 'customer' ? 'success' : s === 'churned' ? 'warn' : 'neutral';
  }
  initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }
}
