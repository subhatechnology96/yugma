import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SupplyChainService } from '../supply-chain.service';
import { ScKanbanComponent } from '../shared/sc-kanban.component';
import { MR_STAGES, MaintenanceKind, MaintenanceRequest, MaintenanceStage } from '../models';

const TEAM = ['Marc Demo', 'Mitchell Admin', 'Joel Willis', 'Lucia Garcia'];

@Component({
  selector: 'app-sc-maintenance',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, TextareaModule, DatePickerModule, TooltipModule, PageHeaderComponent, ScKanbanComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Supply Chain" title="Maintenance" subtitle="Corrective and preventive maintenance requests on shop-floor equipment — drag across stages from request to repaired.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="reload()" placeholder="Search requests…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New request" (click)="openCreate()"></button>
    </app-page-header>

    <app-sc-kanban [stages]="stages" [items]="requests()" stageField="stage" (stageChange)="onStage($event)" (cardClick)="openDetail($any($event))">
      <ng-template let-m>
        <div class="flex items-start justify-between gap-2">
          <div class="text-[13px] font-medium text-surface-800 dark:text-surface-100 leading-snug">{{ m.title }}</div>
          <span class="flex items-center gap-0.5 shrink-0">@for (s of [1,2,3]; track s) { <i class="pi text-[10px]" [class]="s <= m.priority ? 'pi-star-fill text-amber-400' : 'pi-star text-surface-300 dark:text-surface-600'"></i> }</span>
        </div>
        <div class="text-[11px] text-surface-500 mt-0.5">{{ m.reference }} · {{ m.equipment }}</div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full" [class]="m.kind === 'Preventive' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'">{{ m.kind }}</span>
          <span class="text-[11px] text-surface-400 inline-flex items-center gap-1"><i class="pi pi-user text-[10px]"></i>{{ m.responsible || '—' }}</span>
        </div>
        @if (m.scheduledDate) { <div class="text-[11px] text-surface-400 mt-1.5"><i class="pi pi-calendar text-[9px]"></i> {{ m.scheduledDate | date: 'd MMM' }} · {{ m.duration }}h</div> }
      </ng-template>
    </app-sc-kanban>

    <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{ width: '38rem' }" [header]="editing() ? editing()!.reference : 'New maintenance request'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Subject *</label><input pInputText [(ngModel)]="form.title" class="w-full" /></div>
        <div><label class="lbl">Equipment *</label><input pInputText [(ngModel)]="form.equipment" class="w-full" /></div>
        <div><label class="lbl">Maintenance type</label><p-select [(ngModel)]="form.kind" [options]="kindOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Responsible</label><p-select [(ngModel)]="form.responsible" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true"></p-select></div>
        <div><label class="lbl">Priority</label><p-select [(ngModel)]="form.priority" [options]="priorityOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Scheduled date</label><p-datepicker [(ngModel)]="form.scheduled" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        <div><label class="lbl">Duration (hours)</label><p-inputNumber [(ngModel)]="form.duration" [min]="0" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber></div>
        @if (editing()) { <div class="col-span-2"><label class="lbl">Stage</label><p-select [(ngModel)]="form.stage" [options]="stageOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div> }
        <div class="col-span-2"><label class="lbl">Notes</label><textarea pTextarea [(ngModel)]="form.description" rows="2" class="w-full"></textarea></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="dialogVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`.lbl { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--p-surface-400); margin-bottom:3px; }`]
})
export class MaintenanceComponent {
  private readonly svc = inject(SupplyChainService);
  private readonly messages = inject(MessageService);
  protected readonly stages = MR_STAGES;
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly stageOptions = MR_STAGES.map((s) => ({ label: s.label, value: s.key }));
  protected readonly kindOptions = ['Corrective', 'Preventive'].map((k) => ({ label: k, value: k }));
  protected readonly priorityOptions = [0, 1, 2, 3].map((p) => ({ label: '★'.repeat(p) || 'Normal', value: p }));

  protected search = '';
  protected readonly requests = signal<MaintenanceRequest[]>([]);
  protected dialogVisible = false;
  protected readonly editing = signal<MaintenanceRequest | null>(null);
  protected form = this.blank();

  constructor() { this.reload(); }
  reload() { this.svc.maintenance(null, this.search || null).subscribe((r) => this.requests.set(r)); }

  onStage(e: { item: Record<string, unknown>; stage: string }) {
    const m = e.item as unknown as MaintenanceRequest;
    this.svc.mrStage(m.id, e.stage).subscribe({
      next: () => this.messages.add({ severity: 'success', summary: `${m.reference} → ${e.stage}` }),
      error: () => { this.messages.add({ severity: 'error', summary: 'Move failed' }); this.reload(); }
    });
  }

  openCreate() { this.editing.set(null); this.form = this.blank(); this.dialogVisible = true; }
  openDetail(m: MaintenanceRequest) {
    this.editing.set(m);
    this.form = { title: m.title, equipment: m.equipment, kind: m.kind, responsible: m.responsible ?? '', priority: m.priority, scheduled: m.scheduledDate ? new Date(m.scheduledDate) : null, duration: m.duration, stage: m.stage, description: m.description ?? '' };
    this.dialogVisible = true;
  }
  save() {
    if (!this.form.title.trim() || !this.form.equipment.trim()) { this.messages.add({ severity: 'warn', summary: 'Subject and equipment are required' }); return; }
    const body: Partial<MaintenanceRequest> = {
      title: this.form.title.trim(), equipment: this.form.equipment.trim(), kind: this.form.kind, priority: this.form.priority,
      responsible: this.form.responsible || null, scheduledDate: this.toIso(this.form.scheduled), duration: this.form.duration, description: this.form.description || null
    };
    const e = this.editing();
    const obs = e ? this.svc.updateMr(e.id, body) : this.svc.createMr(body);
    obs.subscribe((mr) => {
      if (e && this.form.stage !== e.stage) { this.svc.mrStage(mr.id, this.form.stage).subscribe(() => this.reload()); }
      else this.reload();
      this.dialogVisible = false; this.messages.add({ severity: 'success', summary: e ? 'Saved' : `Created ${mr.reference}` });
    });
  }

  private toIso(d: Date | null): string | null { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; }
  private blank() { return { title: '', equipment: '', kind: 'Corrective' as MaintenanceKind, responsible: '' as string, priority: 0, scheduled: null as Date | null, duration: 1, stage: 'New' as MaintenanceStage, description: '' }; }
}
