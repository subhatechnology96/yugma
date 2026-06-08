import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { SupplyChainService } from '../supply-chain.service';
import { QUALITY_STATUS_META, QualityCheck, QualityCheckType, QualityStatus } from '../models';

const TEAM = ['Marc Demo', 'Mitchell Admin', 'Joel Willis', 'Lucia Garcia'];

@Component({
  selector: 'app-sc-quality',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, TableModule, SelectModule, InputTextModule, TextareaModule, TooltipModule, PageHeaderComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Supply Chain" title="Quality" subtitle="Quality control checks across receipts, in-process and final inspection — pass, fail and track corrective action.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search checks…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New check" (click)="openNew()"></button>
    </app-page-header>

    <div class="grid grid-cols-3 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">To do</div><div class="text-[24px] font-semibold tabular-nums" [class]="counts().todo ? 'text-amber-600 dark:text-amber-400' : 'text-surface-800 dark:text-surface-100'">{{ counts().todo }}</div></div>
      <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Passed</div><div class="text-[24px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ counts().pass }}</div></div>
      <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">Failed</div><div class="text-[24px] font-semibold tabular-nums" [class]="counts().fail ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100'">{{ counts().fail }}</div></div>
    </div>

    <div class="flex flex-wrap items-center gap-1.5 mb-3">
      <button class="chip" [class.chip-on]="!statusFilter()" (click)="setStatus(null)">All</button>
      @for (s of statusChips; track s.key) { <button class="chip" [class.chip-on]="statusFilter() === s.key" (click)="setStatus(s.key)">{{ s.label }}</button> }
    </div>

    <div class="card p-0 overflow-hidden">
      <p-table [value]="rows()" [rowHover]="true" [paginator]="rows().length > 15" [rows]="15" responsiveLayout="scroll">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-[11px] !uppercase !text-surface-500">Reference</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Check</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Product</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Control point</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Status</th>
            <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Action</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-c>
          <tr>
            <td class="font-medium text-sm cursor-pointer" (click)="openEdit(c)">{{ c.reference }}</td>
            <td class="text-sm cursor-pointer" (click)="openEdit(c)"><div>{{ c.title }}</div><div class="text-[11px] text-surface-400">{{ c.checkType }}@if (c.measure) { · {{ c.measure }} }</div></td>
            <td class="text-sm text-surface-500">{{ c.product }}</td>
            <td class="text-sm text-surface-500">{{ c.controlPoint }}</td>
            <td><app-status-pill [tone]="meta(c.status).tone">{{ meta(c.status).label }}</app-status-pill></td>
            <td class="text-right whitespace-nowrap">
              @if (c.status === 'ToDo') {
                <button pButton size="small" severity="success" text icon="pi pi-check" label="Pass" (click)="result(c, 'Pass')"></button>
                <button pButton size="small" severity="danger" text icon="pi pi-times" label="Fail" (click)="result(c, 'Fail')"></button>
              } @else {
                <button pButton size="small" text icon="pi pi-refresh" pTooltip="Reset to To-do" (click)="result(c, 'ToDo')"></button>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="6" class="py-12 text-center text-surface-400 text-sm">No quality checks yet.</td></tr></ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="editorVisible" [modal]="true" [style]="{ width: '36rem' }" [header]="editing() ? editing()!.reference : 'New quality check'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Title *</label><input pInputText [(ngModel)]="form.title" class="w-full" /></div>
        <div><label class="lbl">Product</label><input pInputText [(ngModel)]="form.product" class="w-full" /></div>
        <div><label class="lbl">Check type</label><p-select [(ngModel)]="form.checkType" [options]="typeOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Control point</label><p-select [(ngModel)]="form.controlPoint" [options]="controlPoints" class="w-full" [editable]="true"></p-select></div>
        <div><label class="lbl">Responsible</label><p-select [(ngModel)]="form.responsible" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true"></p-select></div>
        <div><label class="lbl">Source document</label><input pInputText [(ngModel)]="form.sourceDocument" class="w-full" placeholder="WH/IN/0001" /></div>
        <div><label class="lbl">Measure / tolerance</label><input pInputText [(ngModel)]="form.measure" class="w-full" /></div>
        <div class="col-span-2"><label class="lbl">Notes</label><textarea pTextarea [(ngModel)]="form.notes" rows="2" class="w-full"></textarea></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="editorVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .lbl { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--p-surface-400); margin-bottom:3px; }
    .chip { padding:.25rem .7rem; border-radius:9999px; font-size:12px; border:1px solid var(--p-surface-200); color:var(--p-surface-500); transition:all .15s; }
    .chip-on { background:var(--p-surface-800); color:#fff; border-color:var(--p-surface-800); }
    :host-context(.app-dark) .chip-on { background:var(--p-surface-100); color:var(--p-surface-900); }
  `]
})
export class QualityComponent {
  private readonly svc = inject(SupplyChainService);
  private readonly messages = inject(MessageService);
  protected meta(s: string) { return QUALITY_STATUS_META[s as QualityStatus] ?? QUALITY_STATUS_META.ToDo; }
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly typeOptions = [{ label: 'Pass — Fail', value: 'PassFail' }, { label: 'Measure', value: 'Measure' }, { label: 'Instructions', value: 'Instructions' }];
  protected readonly controlPoints = ['Receipt', 'In-Process', 'Final Inspection', 'Packaging'];
  protected readonly statusChips: { key: QualityStatus; label: string }[] = [{ key: 'ToDo', label: 'To Do' }, { key: 'Pass', label: 'Passed' }, { key: 'Fail', label: 'Failed' }];

  protected search = '';
  protected readonly rows = signal<QualityCheck[]>([]);
  protected readonly statusFilter = signal<QualityStatus | null>(null);
  protected readonly counts = computed(() => ({
    todo: this.rows().filter((c) => c.status === 'ToDo').length,
    pass: this.rows().filter((c) => c.status === 'Pass').length,
    fail: this.rows().filter((c) => c.status === 'Fail').length
  }));

  protected editorVisible = false;
  protected readonly editing = signal<QualityCheck | null>(null);
  protected form = this.blank();

  constructor() { this.reloadAll(); }
  // The KPI counts need the full set, so we keep an unfiltered copy when "All".
  private allRows: QualityCheck[] = [];
  reloadAll() { this.svc.qualityChecks(null, this.search || null).subscribe((r) => { this.allRows = r; this.applyFilter(); }); }
  private applyFilter() { const s = this.statusFilter(); this.rows.set(s ? this.allRows.filter((c) => c.status === s) : this.allRows); }

  private timer: ReturnType<typeof setTimeout> | null = null;
  onSearch() { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => this.reloadAll(), 250); }
  setStatus(s: QualityStatus | null) { this.statusFilter.set(s); this.applyFilter(); }

  result(c: QualityCheck, status: QualityStatus) {
    this.svc.qcResult(c.id, status).subscribe(() => { this.reloadAll(); this.messages.add({ severity: status === 'Fail' ? 'warn' : 'success', summary: status === 'Pass' ? 'Passed' : status === 'Fail' ? 'Marked failed' : 'Reset' }); });
  }

  openNew() { this.editing.set(null); this.form = this.blank(); this.editorVisible = true; }
  openEdit(c: QualityCheck) {
    this.editing.set(c);
    this.form = { title: c.title, product: c.product, checkType: c.checkType, controlPoint: c.controlPoint, responsible: c.responsible ?? '', sourceDocument: c.sourceDocument ?? '', measure: c.measure ?? '', notes: c.notes ?? '' };
    this.editorVisible = true;
  }
  save() {
    if (!this.form.title.trim()) { this.messages.add({ severity: 'warn', summary: 'Title is required' }); return; }
    const e = this.editing();
    const obs = e ? this.svc.updateQc(e.id, this.form) : this.svc.createQc(this.form);
    obs.subscribe(() => { this.editorVisible = false; this.reloadAll(); this.messages.add({ severity: 'success', summary: e ? 'Saved' : 'Check created' }); });
  }

  private blank() { return { title: '', product: '', checkType: 'PassFail' as QualityCheckType, controlPoint: 'Receipt', responsible: '' as string, sourceDocument: '', measure: '', notes: '' }; }
}
