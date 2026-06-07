import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';

type Status = 'new' | 'inreview' | 'interviewing' | 'hired' | 'notselected';
interface Referral { id: string; referrer: string; candidateName: string; candidateEmail?: string; position: string; department?: string; status: Status; referredAt: string; bonusAmount: number; bonusPaid: boolean; notes?: string; }
interface Summary { total: number; active: number; hired: number; bonusPending: number; bonusPaid: number; funnel: Record<string, number>; topReferrers: { referrer: string; count: number; hired: number }[]; }

@Component({
  selector: 'app-hr-referrals',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, PageHeaderComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Human Resources" title="Referrals" subtitle="Employee referral program — track referred candidates and reward successful hires.">
      <button pButton severity="secondary" outlined icon="pi pi-plus" label="New referral" (click)="openCreate()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[24px] leading-tight font-semibold mt-0.5 tabular-nums">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card lg:col-span-2 overflow-hidden">
        <div class="flex items-center gap-1.5 p-3 pb-0">
          @for (f of statusFilters; track f.value) {
            <button class="px-2.5 py-1 rounded-full text-xs border transition"
              [class]="filter() === f.value ? 'bg-surface-800 text-white border-surface-800 dark:bg-surface-100 dark:text-surface-900' : 'border-surface-200 dark:border-surface-700 text-surface-500'"
              (click)="setFilter(f.value)">{{ f.label }}</button>
          }
        </div>
        <p-table [value]="filtered()" responsiveLayout="scroll" [rowHover]="true" class="p-1">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!text-xs !uppercase !text-surface-500">Candidate</th>
              <th class="!text-xs !uppercase !text-surface-500">Referred by</th>
              <th class="!text-xs !uppercase !text-surface-500">Bonus</th>
              <th class="!text-xs !uppercase !text-surface-500">Status</th>
              <th class="!w-44"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-r>
            <tr>
              <td>
                <div class="flex items-center gap-2">
                  <app-avatar [name]="r.candidateName" size="xs" />
                  <div class="min-w-0">
                    <div class="text-sm font-medium truncate">{{ r.candidateName }}</div>
                    <div class="text-[11px] text-surface-400 truncate">{{ r.position }}{{ r.department ? ' · ' + r.department : '' }}</div>
                  </div>
                </div>
              </td>
              <td class="text-sm">{{ r.referrer }}<div class="text-[11px] text-surface-400">{{ r.referredAt | date: 'mediumDate' }}</div></td>
              <td class="text-sm tabular-nums">{{ money(r.bonusAmount) }}
                @if (r.bonusPaid) { <span class="text-[10px] text-emerald-500 block">Paid</span> }
                @else if (r.status === 'hired') { <span class="text-[10px] text-amber-500 block">Pending</span> }
              </td>
              <td><span class="text-[11px] px-2 py-0.5 rounded-full" [class]="tone(r.status)">{{ label(r.status) }}</span></td>
              <td (click)="$event.stopPropagation()" class="text-right whitespace-nowrap">
                @if (r.status !== 'hired' && r.status !== 'notselected') {
                  <p-select [options]="advanceOptions" [ngModel]="r.status" (ngModelChange)="move(r, $event)" optionLabel="label" optionValue="value" styleClass="!text-xs" appendTo="body" />
                } @else if (r.status === 'hired' && !r.bonusPaid) {
                  <button pButton size="small" outlined class="!text-[11px] !py-0.5" icon="pi pi-wallet" label="Pay bonus" (click)="payBonus(r)"></button>
                } @else { <span class="text-[11px] text-surface-400">—</span> }
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage"><tr><td colspan="5" class="py-10 text-center text-surface-500">No referrals.</td></tr></ng-template>
        </p-table>
      </div>

      <div class="card p-4 self-start">
        <div class="section-title mb-3">Top referrers</div>
        <div class="divide-y divide-surface-100 dark:divide-surface-800">
          @for (t of summary()?.topReferrers ?? []; track t.referrer) {
            <div class="flex items-center gap-3 py-2.5">
              <app-avatar [name]="t.referrer" size="xs" />
              <div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">{{ t.referrer }}</div><div class="text-[11px] text-surface-400">{{ t.hired }} hired</div></div>
              <span class="text-sm font-semibold tabular-nums">{{ t.count }}</span>
            </div>
          }
          @if (!(summary()?.topReferrers ?? []).length) { <div class="text-xs text-surface-400 py-3">No referrals yet.</div> }
        </div>
      </div>
    </div>

    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '32rem' }" header="New referral" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div><label class="text-xs font-medium text-surface-600">Referred by</label><input pInputText [(ngModel)]="form.referrer" class="w-full mt-1 !rounded-lg" placeholder="Employee" /></div>
        <div><label class="text-xs font-medium text-surface-600">Candidate</label><input pInputText [(ngModel)]="form.candidateName" class="w-full mt-1 !rounded-lg" placeholder="Name" /></div>
        <div><label class="text-xs font-medium text-surface-600">Position</label><input pInputText [(ngModel)]="form.position" class="w-full mt-1 !rounded-lg" placeholder="Role" /></div>
        <div><label class="text-xs font-medium text-surface-600">Department</label><input pInputText [(ngModel)]="form.department" class="w-full mt-1 !rounded-lg" placeholder="Department" /></div>
        <div><label class="text-xs font-medium text-surface-600">Candidate email</label><input pInputText [(ngModel)]="form.candidateEmail" class="w-full mt-1 !rounded-lg" placeholder="name@email.com" /></div>
        <div><label class="text-xs font-medium text-surface-600">Bonus (₹)</label><p-inputNumber [(ngModel)]="form.bonusAmount" [min]="0" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Add referral" [disabled]="!form.referrer.trim() || !form.candidateName.trim()" (click)="submitCreate()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class ReferralsComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/my-work/referrals`;

  protected readonly referrals = signal<Referral[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly filter = signal<Status | null>(null);
  protected readonly statusFilters = [
    { label: 'All', value: null }, { label: 'New', value: 'new' }, { label: 'In review', value: 'inreview' }, { label: 'Interviewing', value: 'interviewing' }, { label: 'Hired', value: 'hired' }, { label: 'Not selected', value: 'notselected' }
  ];
  protected readonly advanceOptions = [
    { label: 'New', value: 'new' }, { label: 'In review', value: 'inreview' }, { label: 'Interviewing', value: 'interviewing' }, { label: 'Hired', value: 'hired' }, { label: 'Not selected', value: 'notselected' }
  ];

  createVisible = false;
  form = this.blank();

  constructor() { this.reload(); }
  reload() {
    forkJoin({ list: this.http.get<Referral[]>(this.base), summary: this.http.get<Summary>(`${this.base}/summary`) })
      .subscribe((r) => { this.referrals.set(r.list); this.summary.set(r.summary); });
  }

  protected readonly filtered = computed(() => { const f = this.filter(); return f ? this.referrals().filter((r) => r.status === f) : this.referrals(); });
  setFilter(s: string | null) { this.filter.set((s as Status) || null); }

  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Total referrals', value: s?.total ?? 0, caption: 'all time' },
      { label: 'Active', value: s?.active ?? 0, caption: 'in pipeline' },
      { label: 'Hired', value: s?.hired ?? 0, caption: 'successful' },
      { label: 'Bonus pending', value: this.money(s?.bonusPending ?? 0), caption: 'to pay out' }
    ];
  });

  move(r: Referral, status: Status) {
    if (status === r.status) return;
    this.http.post(`${this.base}/${r.id}/status`, { status }).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Updated', detail: `${r.candidateName} → ${this.label(status)}` }); this.reload(); });
  }
  payBonus(r: Referral) {
    this.http.post(`${this.base}/${r.id}/bonus-paid`, {}).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Bonus paid', detail: r.referrer }); this.reload(); });
  }
  openCreate() { this.form = this.blank(); this.createVisible = true; }
  submitCreate() {
    this.http.post(this.base, { ...this.form }).subscribe({ next: () => { this.messages.add({ severity: 'success', summary: 'Referral added' }); this.createVisible = false; this.reload(); }, error: () => this.messages.add({ severity: 'error', summary: 'Failed' }) });
  }

  label(s: string): string { return ({ new: 'New', inreview: 'In review', interviewing: 'Interviewing', hired: 'Hired', notselected: 'Not selected' } as Record<string, string>)[s] ?? s; }
  tone(s: string): string {
    return ({ new: 'bg-surface-100 text-surface-500 dark:bg-surface-800', inreview: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300', interviewing: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300', hired: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', notselected: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' } as Record<string, string>)[s] ?? '';
  }
  money(n: number): string { return '₹' + Math.round(n).toLocaleString('en-IN'); }
  private blank() { return { referrer: '', candidateName: '', position: '', department: '', candidateEmail: '', bonusAmount: 50000 }; }
}
