import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { LeadService, LeadInput } from '../services/lead.service';
import { LEAD_SOURCES, Lead, LeadStatus } from '../models/crm.models';

const OWNERS = ['Vikram Singh', 'Meera Krishnan', 'Arjun Trivedi'];

@Component({
  selector: 'app-leads-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
    SelectModule,
    DialogModule,
    TooltipModule,
    PageHeaderComponent,
    StatusPillComponent,
    AvatarComponent,
    KpiCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM" title="Leads" subtitle="Inbound and sourced leads, scored and ready to qualify.">
      <button pButton severity="secondary" outlined icon="pi pi-upload" label="Import"></button>
      <button pButton icon="pi pi-plus" label="Add lead" (click)="openCreate()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Total leads" [value]="kpis().total" icon="pi-users" tone="brand" />
      <app-kpi-card label="Qualified" [value]="kpis().qualified" icon="pi-verified" tone="emerald" />
      <app-kpi-card label="Avg. score" [value]="kpis().avgScore" icon="pi-gauge" tone="indigo" />
      <app-kpi-card label="Converted" [value]="kpis().converted" icon="pi-arrow-right-arrow-left" tone="amber" />
    </div>

    <div class="card">
      <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="p-input-icon-left">
            <input pInputText type="text" placeholder="Search leads…" (input)="dt.filterGlobal($any($event.target).value, 'contains')" class="!h-9 w-64" />
          </span>
          <p-select [options]="statusOptions" [(ngModel)]="statusFilter" optionLabel="label" optionValue="value" styleClass="!h-9" />
        </div>
        <span class="text-xs text-surface-500">{{ filtered().length }} of {{ leadSvc.all().length }} leads</span>
      </div>

      <p-table #dt [value]="filtered()" [paginator]="true" [rows]="10" [rowsPerPageOptions]="[10, 25, 50]"
        [globalFilterFields]="['fullName', 'company', 'email', 'owner', 'code']" responsiveLayout="scroll" [rowHover]="true">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase" pSortableColumn="fullName">Name</th>
            <th class="!text-xs !uppercase" pSortableColumn="company">Company</th>
            <th class="!text-xs !uppercase" pSortableColumn="source">Source</th>
            <th class="!text-xs !uppercase" pSortableColumn="status">Status</th>
            <th class="!text-xs !uppercase" pSortableColumn="score">Score</th>
            <th class="!text-xs !uppercase">Owner</th>
            <th class="!text-xs !uppercase !text-right">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-lead>
          <tr>
            <td>
              <div class="flex items-center gap-2">
                <app-avatar [name]="lead.fullName" size="sm" />
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{{ lead.fullName }}</div>
                  <div class="text-xs text-surface-500 truncate">{{ lead.email }}</div>
                </div>
              </div>
            </td>
            <td class="text-sm">{{ lead.company }}</td>
            <td class="text-sm">{{ lead.source }}</td>
            <td><app-status-pill [tone]="statusTone(lead.status)">{{ statusLabel(lead.status) }}</app-status-pill></td>
            <td>
              <div class="flex items-center gap-2">
                <div class="w-16 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div class="h-full rounded-full" [style.width.%]="lead.score" [style.background]="scoreColor(lead.score)"></div>
                </div>
                <span class="text-xs font-semibold tabular-nums w-6">{{ lead.score }}</span>
              </div>
            </td>
            <td>
              <div class="flex items-center gap-2">
                <app-avatar [name]="lead.owner" size="xs" />
                <span class="text-sm">{{ lead.owner }}</span>
              </div>
            </td>
            <td class="!text-right whitespace-nowrap">
              <button pButton size="small" text rounded icon="pi pi-pencil" pTooltip="Edit" (click)="openEdit(lead)"></button>
              @if (lead.status !== 'converted') {
                <button pButton size="small" severity="secondary" outlined icon="pi pi-arrow-right-arrow-left" label="Convert" class="!ml-1" (click)="openConvert(lead)"></button>
              } @else {
                <app-status-pill tone="success">Converted</app-status-pill>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="text-center text-sm text-surface-500 py-10">No leads match your filters.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Add / Edit dialog -->
    <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="editingId() ? 'Edit lead' : 'New lead'" [draggable]="false">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Full name</label>
          <input pInputText [(ngModel)]="form.fullName" class="w-full mt-1" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Company</label>
          <input pInputText [(ngModel)]="form.company" class="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Email</label>
          <input pInputText [(ngModel)]="form.email" class="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Phone</label>
          <input pInputText [(ngModel)]="form.phone" class="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Source</label>
          <p-select [options]="sourceOptions" [(ngModel)]="form.source" styleClass="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Owner</label>
          <p-select [options]="ownerOptions" [(ngModel)]="form.owner" styleClass="w-full mt-1" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Score: {{ form.score }}</label>
          <p-inputNumber [(ngModel)]="form.score" [min]="0" [max]="100" [showButtons]="true" styleClass="w-full mt-1" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="dialogVisible = false"></button>
        <button pButton label="Save lead" [disabled]="!canSave()" (click)="save()"></button>
      </ng-template>
    </p-dialog>

    <!-- Convert dialog -->
    <p-dialog [(visible)]="convertVisible" [modal]="true" [style]="{ width: '28rem' }" header="Convert lead to deal" [draggable]="false">
      @if (converting(); as c) {
        <p class="text-sm text-surface-600 dark:text-surface-400 pt-1">
          Creates an account (<b>{{ c.company }}</b>), a primary contact (<b>{{ c.fullName }}</b>) and a new deal — atomically.
        </p>
        <div class="mt-4 space-y-3">
          <div>
            <label class="text-xs font-medium text-surface-600">Deal name</label>
            <input pInputText [(ngModel)]="convertForm.dealName" class="w-full mt-1" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Estimated value (₹)</label>
            <p-inputNumber [(ngModel)]="convertForm.dealValue" mode="currency" currency="INR" locale="en-IN" styleClass="w-full mt-1" />
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="convertVisible = false"></button>
        <button pButton label="Convert to deal" icon="pi pi-arrow-right-arrow-left" (click)="confirmConvert()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class LeadsListComponent {
  protected readonly leadSvc = inject(LeadService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly statusFilter = signal<LeadStatus | null>(null);

  readonly statusOptions = [
    { label: 'All statuses', value: null },
    { label: 'New', value: 'new' },
    { label: 'Working', value: 'working' },
    { label: 'Qualified', value: 'qualified' },
    { label: 'Unqualified', value: 'unqualified' },
    { label: 'Converted', value: 'converted' }
  ];
  readonly sourceOptions = LEAD_SOURCES.map((s) => ({ label: s, value: s }));
  readonly ownerOptions = OWNERS.map((o) => ({ label: o, value: o }));

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    const all = this.leadSvc.all();
    return f ? all.filter((l) => l.status === f) : all;
  });

  readonly kpis = computed(() => {
    const all = this.leadSvc.all();
    const open = all.filter((l) => l.status !== 'converted' && l.status !== 'unqualified');
    return {
      total: all.length,
      qualified: all.filter((l) => l.status === 'qualified').length,
      avgScore: Math.round(open.reduce((s, l) => s + l.score, 0) / Math.max(open.length, 1)),
      converted: all.filter((l) => l.status === 'converted').length
    };
  });

  // dialog state
  dialogVisible = false;
  readonly editingId = signal<string | null>(null);
  form: LeadInput = this.blankForm();

  // convert state
  convertVisible = false;
  readonly converting = signal<Lead | null>(null);
  convertForm = { dealName: '', dealValue: 0 };

  constructor() {
    this.leadSvc.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form = this.blankForm();
    this.dialogVisible = true;
  }

  openEdit(lead: Lead): void {
    this.editingId.set(lead.id);
    this.form = { fullName: lead.fullName, company: lead.company, email: lead.email, phone: lead.phone, source: lead.source, score: lead.score, owner: lead.owner };
    this.dialogVisible = true;
  }

  canSave(): boolean {
    return !!(this.form.fullName && this.form.company && this.form.email && this.form.phone && this.form.owner);
  }

  save(): void {
    const id = this.editingId();
    const op = id ? this.leadSvc.update(id, this.form) : this.leadSvc.create(this.form);
    op.subscribe((lead) => {
      this.messages.add({ severity: 'success', summary: id ? 'Lead updated' : 'Lead created', detail: lead.fullName });
      this.dialogVisible = false;
    });
  }

  openConvert(lead: Lead): void {
    this.converting.set(lead);
    this.convertForm = { dealName: `${lead.company} — New opportunity`, dealValue: 0 };
    this.convertVisible = true;
  }

  confirmConvert(): void {
    const lead = this.converting();
    if (!lead) return;
    this.leadSvc.convert(lead.id, { dealName: this.convertForm.dealName, dealValue: this.convertForm.dealValue }).subscribe((res) => {
      this.messages.add({ severity: 'success', summary: 'Lead converted', detail: `${lead.fullName} → deal ${res.dealCode}` });
      this.convertVisible = false;
      this.router.navigate(['/crm/deals']);
    });
  }

  statusTone(s: LeadStatus): 'success' | 'warn' | 'danger' | 'info' | 'neutral' {
    return s === 'qualified' ? 'success' : s === 'working' ? 'info' : s === 'unqualified' ? 'danger' : s === 'converted' ? 'success' : 'neutral';
  }
  statusLabel(s: LeadStatus): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  scoreColor(score: number): string {
    return score >= 75 ? '#10b981' : score >= 50 ? '#4361ff' : '#f59e0b';
  }

  private blankForm(): LeadInput {
    return { fullName: '', company: '', email: '', phone: '', source: 'Website', score: 50, owner: OWNERS[0] };
  }
}
