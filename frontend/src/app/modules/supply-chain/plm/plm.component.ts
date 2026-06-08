import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SupplyChainService } from '../supply-chain.service';
import { ScKanbanComponent } from '../shared/sc-kanban.component';
import { ECO_STAGES, ECO_TYPE_LABELS, EcoStage, EcoType, EngineeringChange } from '../models';

const TEAM = ['Marc Demo', 'Mitchell Admin', 'Joel Willis', 'Lucia Garcia'];

@Component({
  selector: 'app-sc-plm',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, SelectModule, InputTextModule, TextareaModule, DatePickerModule, TooltipModule, PageHeaderComponent, ScKanbanComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Supply Chain · PLM" title="Engineering Changes" subtitle="Product Lifecycle Management — track engineering change orders (ECO) on bills of materials, designs and routings from request to approval.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="reload()" placeholder="Search ECOs…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New ECO" (click)="openCreate()"></button>
    </app-page-header>

    <app-sc-kanban [stages]="stages" [items]="ecos()" stageField="stage" (stageChange)="onStage($event)" (cardClick)="openDetail($any($event))">
      <ng-template let-e>
        <div class="flex items-start justify-between gap-2">
          <div class="text-[13px] font-medium text-surface-800 dark:text-surface-100 leading-snug">{{ e.title }}</div>
          <span class="flex items-center gap-0.5 shrink-0">
            @for (s of [1,2,3]; track s) { <i class="pi text-[10px]" [class]="s <= e.priority ? 'pi-star-fill text-amber-400' : 'pi-star text-surface-300 dark:text-surface-600'"></i> }
          </span>
        </div>
        <div class="text-[11px] text-surface-500 mt-0.5">{{ e.reference }} · {{ e.product }}</div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">{{ typeLabel(e.changeType) }}</span>
          <span class="text-[11px] text-surface-400 inline-flex items-center gap-1"><i class="pi pi-user text-[10px]"></i>{{ e.responsible || '—' }}</span>
        </div>
      </ng-template>
    </app-sc-kanban>

    <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{ width: '38rem' }" [header]="editing() ? editing()!.reference : 'New engineering change'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Title *</label><input pInputText [(ngModel)]="form.title" class="w-full" /></div>
        <div><label class="lbl">Product</label><input pInputText [(ngModel)]="form.product" class="w-full" /></div>
        <div><label class="lbl">Change type</label><p-select [(ngModel)]="form.changeType" [options]="typeOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Responsible</label><p-select [(ngModel)]="form.responsible" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true"></p-select></div>
        <div><label class="lbl">Priority</label><p-select [(ngModel)]="form.priority" [options]="priorityOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        @if (editing()) { <div><label class="lbl">Stage</label><p-select [(ngModel)]="form.stage" [options]="stageOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div> }
        <div [class.col-span-2]="!editing()"><label class="lbl">Effective date</label><p-datepicker [(ngModel)]="form.effective" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        <div class="col-span-2"><label class="lbl">Description</label><textarea pTextarea [(ngModel)]="form.description" rows="3" class="w-full"></textarea></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="dialogVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`.lbl { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--p-surface-400); margin-bottom:3px; }`]
})
export class PlmComponent {
  private readonly svc = inject(SupplyChainService);
  private readonly messages = inject(MessageService);
  protected readonly stages = ECO_STAGES;
  protected typeLabel(t: string) { return ECO_TYPE_LABELS[t as EcoType] ?? t; }
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly stageOptions = ECO_STAGES.map((s) => ({ label: s.label, value: s.key })).concat([{ label: 'Rejected', value: 'Rejected' as EcoStage }]);
  protected readonly typeOptions = (Object.keys(ECO_TYPE_LABELS) as EcoType[]).map((k) => ({ label: ECO_TYPE_LABELS[k], value: k }));
  protected readonly priorityOptions = [0, 1, 2, 3].map((p) => ({ label: '★'.repeat(p) || 'Normal', value: p }));

  protected search = '';
  protected readonly ecos = signal<EngineeringChange[]>([]);
  protected dialogVisible = false;
  protected readonly editing = signal<EngineeringChange | null>(null);
  protected form = this.blank();

  constructor() { this.reload(); }
  reload() { this.svc.ecos(null, this.search || null).subscribe((e) => this.ecos.set(e)); }

  onStage(e: { item: Record<string, unknown>; stage: string }) {
    const eco = e.item as unknown as EngineeringChange;
    this.svc.ecoStage(eco.id, e.stage).subscribe({
      next: () => this.messages.add({ severity: 'success', summary: `${eco.reference} → ${e.stage}` }),
      error: () => { this.messages.add({ severity: 'error', summary: 'Move failed' }); this.reload(); }
    });
  }

  openCreate() { this.editing.set(null); this.form = this.blank(); this.dialogVisible = true; }
  openDetail(e: EngineeringChange) {
    this.editing.set(e);
    this.form = { title: e.title, product: e.product, changeType: e.changeType, responsible: e.responsible ?? '', priority: e.priority, stage: e.stage, effective: e.effectiveDate ? new Date(e.effectiveDate) : null, description: e.description ?? '' };
    this.dialogVisible = true;
  }
  save() {
    if (!this.form.title.trim()) { this.messages.add({ severity: 'warn', summary: 'Title is required' }); return; }
    const body: Partial<EngineeringChange> = {
      title: this.form.title.trim(), product: this.form.product || '—', changeType: this.form.changeType, priority: this.form.priority,
      responsible: this.form.responsible || null, description: this.form.description || null, effectiveDate: this.toIso(this.form.effective)
    };
    const e = this.editing();
    const obs = e ? this.svc.updateEco(e.id, body) : this.svc.createEco(body);
    obs.subscribe((eco) => {
      if (e && this.form.stage !== e.stage) { this.svc.ecoStage(eco.id, this.form.stage).subscribe(() => this.reload()); }
      else this.reload();
      this.dialogVisible = false; this.messages.add({ severity: 'success', summary: e ? 'Saved' : `Created ${eco.reference}` });
    });
  }

  private toIso(d: Date | null): string | null { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; }
  private blank() { return { title: '', product: '', changeType: 'BillOfMaterials' as EcoType, responsible: '' as string, priority: 0, stage: 'New' as EcoStage, effective: null as Date | null, description: '' }; }
}
