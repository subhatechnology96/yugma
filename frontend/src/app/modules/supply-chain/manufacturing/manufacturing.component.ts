import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SupplyChainService } from '../supply-chain.service';
import { ScKanbanComponent } from '../shared/sc-kanban.component';
import { BomComponent, MO_STAGES, ManufacturingOrder, ManufacturingStage } from '../models';

const TEAM = ['Marc Demo', 'Mitchell Admin', 'Joel Willis', 'Lucia Garcia'];

@Component({
  selector: 'app-sc-manufacturing',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, DatePickerModule, PageHeaderComponent, ScKanbanComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Supply Chain" title="Manufacturing" subtitle="Manufacturing orders from components to finished goods — drag across stages to confirm, start and close production.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="reload()" placeholder="Search orders…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New order" (click)="openCreate()"></button>
    </app-page-header>

    <app-sc-kanban [stages]="stages" [items]="orders()" stageField="stage" (stageChange)="onStage($event)" (cardClick)="openDetail($any($event))">
      <ng-template let-o>
        <div class="text-[13px] font-medium text-surface-800 dark:text-surface-100 leading-snug">{{ o.product }}</div>
        <div class="text-[11px] text-surface-500 mt-0.5">{{ o.reference }}</div>
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-surface-600 dark:text-surface-300 tabular-nums">{{ o.quantity }} {{ o.uom }}</span>
          <span class="text-[11px] text-surface-400">{{ o.components.length }} comp.</span>
        </div>
        <div class="mt-2 pt-2 border-t border-surface-100 dark:border-surface-800/70 flex items-center justify-between text-[11px] text-surface-400">
          <span class="inline-flex items-center gap-1 min-w-0"><i class="pi pi-user text-[10px]"></i><span class="truncate">{{ o.responsible || 'Unassigned' }}</span></span>
          <span><i class="pi pi-calendar text-[9px]"></i> {{ o.scheduledDate | date: 'd MMM' }}</span>
        </div>
      </ng-template>
    </app-sc-kanban>

    <!-- create / detail dialog -->
    <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{ width: '40rem' }" [header]="editing() ? editing()!.reference : 'New manufacturing order'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Finished product *</label><input pInputText [(ngModel)]="form.product" class="w-full" /></div>
        <div><label class="lbl">Quantity to produce</label><p-inputNumber [(ngModel)]="form.quantity" [min]="1" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Responsible</label><p-select [(ngModel)]="form.responsible" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true"></p-select></div>
        <div><label class="lbl">Scheduled date</label><p-datepicker [(ngModel)]="form.scheduled" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        @if (editing()) { <div><label class="lbl">Stage</label><p-select [(ngModel)]="form.stage" [options]="stageOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div> }
      </div>
      <div class="mt-4">
        <div class="flex items-center justify-between mb-1.5"><span class="lbl !mb-0">Components (Bill of Materials)</span><button class="text-brand-600 text-xs hover:underline" (click)="addComp()"><i class="pi pi-plus text-[10px] mr-1"></i>Add component</button></div>
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
          @for (c of comps(); track $index; let i = $index) {
            <div class="flex items-center gap-2 px-2 py-1.5">
              <input pInputText [(ngModel)]="c.product" placeholder="Component" class="flex-1 !text-sm" />
              <p-inputNumber [(ngModel)]="c.quantity" [min]="0" mode="decimal" inputStyleClass="!w-16 !text-right"></p-inputNumber>
              <button class="text-surface-300 hover:text-rose-500" (click)="removeComp(i)"><i class="pi pi-trash text-xs"></i></button>
            </div>
          }
          @if (!comps().length) { <div class="px-3 py-3 text-center text-xs text-surface-400">No components — add the parts this order consumes.</div> }
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="dialogVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`.lbl { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--p-surface-400); margin-bottom:3px; }`]
})
export class ManufacturingComponent {
  private readonly svc = inject(SupplyChainService);
  private readonly messages = inject(MessageService);
  protected readonly stages = MO_STAGES;
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly stageOptions = MO_STAGES.map((s) => ({ label: s.label, value: s.key }));

  protected search = '';
  protected readonly orders = signal<ManufacturingOrder[]>([]);
  protected dialogVisible = false;
  protected readonly editing = signal<ManufacturingOrder | null>(null);
  protected form = this.blank();
  protected readonly comps = signal<BomComponent[]>([]);

  constructor() { this.reload(); }
  reload() { this.svc.manufacturingOrders(null, this.search || null).subscribe((o) => this.orders.set(o)); }

  onStage(e: { item: Record<string, unknown>; stage: string }) {
    const o = e.item as unknown as ManufacturingOrder;
    this.svc.moStage(o.id, e.stage).subscribe({
      next: () => this.messages.add({ severity: 'success', summary: `${o.reference} → ${e.stage}` }),
      error: () => { this.messages.add({ severity: 'error', summary: 'Move failed' }); this.reload(); }
    });
  }

  openCreate() { this.editing.set(null); this.form = this.blank(); this.comps.set([]); this.dialogVisible = true; }
  openDetail(o: ManufacturingOrder) {
    this.editing.set(o);
    this.form = { product: o.product, quantity: o.quantity, responsible: o.responsible ?? '', scheduled: o.scheduledDate ? new Date(o.scheduledDate) : new Date(), stage: o.stage };
    this.comps.set(o.components.map((c) => ({ ...c })));
    this.dialogVisible = true;
  }
  addComp() { this.comps.set([...this.comps(), { product: '', quantity: 1, uom: 'Units', consumed: false }]); }
  removeComp(i: number) { const c = [...this.comps()]; c.splice(i, 1); this.comps.set(c); }

  save() {
    if (!this.form.product.trim()) { this.messages.add({ severity: 'warn', summary: 'Product is required' }); return; }
    const body: Partial<ManufacturingOrder> = {
      product: this.form.product.trim(), quantity: this.form.quantity, responsible: this.form.responsible || null,
      scheduledDate: this.toIso(this.form.scheduled) as string,
      components: this.comps().filter((c) => c.product.trim())
    };
    const e = this.editing();
    const obs = e ? this.svc.updateMo(e.id, body) : this.svc.createMo(body);
    obs.subscribe((mo) => {
      // apply a stage change too if editing
      if (e && this.form.stage !== e.stage) { this.svc.moStage(mo.id, this.form.stage).subscribe(() => this.reload()); }
      else this.reload();
      this.dialogVisible = false; this.messages.add({ severity: 'success', summary: e ? 'Saved' : `Created ${mo.reference}` });
    });
  }

  private toIso(d: Date | null): string | null { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; }
  private blank() { return { product: '', quantity: 1, responsible: '' as string, scheduled: new Date() as Date | null, stage: 'Draft' as ManufacturingStage }; }
}
