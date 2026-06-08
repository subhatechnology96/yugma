import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SupplyChainService } from '../supply-chain.service';
import { PURCHASE_STATUS_META, PurchaseLine, PurchaseOrder, PurchaseStatus } from '../models';

const TEAM = ['Marc Demo', 'Mitchell Admin', 'Joel Willis', 'Lucia Garcia'];
interface EditLine { product: string; description: string | null; quantity: number; unitPrice: number; taxPercent: number; }

@Component({
  selector: 'app-sc-purchase',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, TableModule, SelectModule, InputTextModule, InputNumberModule, DatePickerModule, PageHeaderComponent, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Supply Chain" title="Purchase" subtitle="Requests for quotation and purchase orders to your vendors — RFQ → confirmed purchase → received.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New RFQ" (click)="openNew()"></button>
    </app-page-header>

    <div class="flex flex-wrap items-center gap-1.5 mb-3">
      <button class="chip" [class.chip-on]="!statusFilter()" (click)="setStatus(null)">All</button>
      @for (s of statusChips; track s.key) { <button class="chip" [class.chip-on]="statusFilter() === s.key" (click)="setStatus(s.key)">{{ s.label }}</button> }
    </div>

    <div class="card p-0 overflow-hidden">
      <p-table [value]="rows()" [rowHover]="true" [paginator]="rows().length > 15" [rows]="15" responsiveLayout="scroll">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-[11px] !uppercase !text-surface-500">Reference</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Vendor</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Order date</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Buyer</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Status</th>
            <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Total</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-p>
          <tr class="cursor-pointer" (click)="openEdit(p)">
            <td class="font-medium text-sm">{{ p.number }}</td>
            <td class="text-sm">{{ p.vendor }}</td>
            <td class="text-sm text-surface-500">{{ p.orderDate | date: 'dd MMM yyyy' }}</td>
            <td class="text-sm text-surface-500">{{ p.responsible || '—' }}</td>
            <td><app-status-pill [tone]="meta(p.status).tone">{{ meta(p.status).label }}</app-status-pill></td>
            <td class="text-right font-semibold tabular-nums text-sm">{{ p.total | inr }}</td>
            <td class="text-right"><i class="pi pi-angle-right text-surface-300"></i></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="7" class="py-12 text-center text-surface-400 text-sm">No purchase orders yet.</td></tr></ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="editorVisible" [modal]="true" [style]="{ width: '60rem' }" styleClass="!max-w-[96vw]" [draggable]="false">
      <ng-template pTemplate="header">
        <div class="flex items-center gap-3"><span class="text-lg font-semibold">{{ editing()?.number || 'New RFQ' }}</span>@if (editing(); as e) { <app-status-pill [tone]="meta(e.status).tone">{{ meta(e.status).label }}</app-status-pill> }</div>
      </ng-template>

      <div class="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-surface-100 dark:border-surface-800">
        @if (editing()?.status === 'Rfq' || editing()?.status === 'Sent') {
          <button pButton size="small" icon="pi pi-send" label="Send RFQ" severity="secondary" outlined (click)="doAction('send')" [disabled]="!editing()"></button>
          <button pButton size="small" icon="pi pi-check" label="Confirm Order" (click)="doAction('confirm')" [disabled]="!editing()"></button>
        }
        @if (editing()?.status === 'Purchase') { <button pButton size="small" icon="pi pi-inbox" label="Receive Products" severity="success" (click)="doAction('receive')"></button> }
        @if (editing()?.status === 'Received') { <span class="text-xs text-emerald-600 inline-flex items-center gap-1"><i class="pi pi-check-circle"></i> Received into stock</span> }
        @if (editing() && editing()?.status !== 'Cancelled' && editing()?.status !== 'Received') { <button pButton size="small" icon="pi pi-times" label="Cancel" severity="danger" text (click)="doAction('cancel')"></button> }
        @if (editing()?.status === 'Cancelled') { <button pButton size="small" icon="pi pi-refresh" label="Set to Draft" severity="secondary" outlined (click)="doAction('draft')"></button> }
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div class="lg:col-span-2"><label class="lbl">Vendor *</label><input pInputText [(ngModel)]="head.vendor" class="w-full" /></div>
        <div><label class="lbl">Vendor email</label><input pInputText [(ngModel)]="head.vendorEmail" class="w-full" /></div>
        <div><label class="lbl">Buyer</label><p-select [(ngModel)]="head.responsible" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true"></p-select></div>
        <div><label class="lbl">Order date</label><p-datepicker [(ngModel)]="head.orderDate" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        <div><label class="lbl">Expected arrival</label><p-datepicker [(ngModel)]="head.expectedDate" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
      </div>

      <div class="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden mb-3">
        <table class="w-full text-sm">
          <thead><tr class="bg-surface-50 dark:bg-surface-900/40 text-[11px] uppercase text-surface-500">
            <th class="text-left font-medium px-3 py-2 w-[38%]">Product</th><th class="text-left font-medium px-3 py-2">Description</th>
            <th class="text-right font-medium px-3 py-2 w-20">Qty</th><th class="text-right font-medium px-3 py-2 w-28">Unit Price</th>
            <th class="text-right font-medium px-3 py-2 w-16">Tax %</th><th class="text-right font-medium px-3 py-2 w-28">Subtotal</th><th class="w-8"></th>
          </tr></thead>
          <tbody>
            @for (l of lines(); track $index; let i = $index) {
              <tr class="border-t border-surface-100 dark:border-surface-800">
                <td class="px-2 py-1.5"><input pInputText [(ngModel)]="l.product" class="w-full !text-sm" placeholder="Product" /></td>
                <td class="px-2 py-1.5"><input pInputText [(ngModel)]="l.description" class="w-full !text-sm" placeholder="—" /></td>
                <td class="px-2 py-1.5"><p-inputNumber [(ngModel)]="l.quantity" [min]="0" mode="decimal" [maxFractionDigits]="2" inputStyleClass="!text-right !w-16" (onInput)="touch()"></p-inputNumber></td>
                <td class="px-2 py-1.5"><p-inputNumber [(ngModel)]="l.unitPrice" [min]="0" mode="decimal" [minFractionDigits]="2" inputStyleClass="!text-right !w-24" (onInput)="touch()"></p-inputNumber></td>
                <td class="px-2 py-1.5"><p-inputNumber [(ngModel)]="l.taxPercent" [min]="0" [max]="100" inputStyleClass="!text-right !w-12" (onInput)="touch()"></p-inputNumber></td>
                <td class="px-3 py-1.5 text-right tabular-nums font-medium">{{ lineSubtotal(l) | inr }}</td>
                <td class="px-1 text-center"><button class="text-surface-300 hover:text-rose-500" (click)="removeLine(i)"><i class="pi pi-trash text-xs"></i></button></td>
              </tr>
            }
            @if (!lines().length) { <tr><td colspan="7" class="px-3 py-4 text-center text-surface-400 text-xs">No lines yet — add a product.</td></tr> }
          </tbody>
        </table>
        <div class="px-3 py-2 border-t border-surface-100 dark:border-surface-800"><button class="text-brand-600 text-xs hover:underline" (click)="addLine()"><i class="pi pi-plus text-[10px] mr-1"></i>Add a product</button></div>
      </div>

      <div class="flex justify-end">
        <div class="w-72 space-y-1.5 text-sm">
          <div class="flex justify-between text-surface-500"><span>Untaxed Amount</span><span class="tabular-nums">{{ totals().untaxed | inr }}</span></div>
          <div class="flex justify-between text-surface-500"><span>Taxes</span><span class="tabular-nums">{{ totals().tax | inr }}</span></div>
          <div class="flex justify-between text-base font-semibold pt-1.5 border-t border-surface-200 dark:border-surface-700"><span>Total</span><span class="tabular-nums">{{ totals().total | inr }}</span></div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Close" (click)="editorVisible = false"></button>
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
export class PurchaseComponent {
  private readonly svc = inject(SupplyChainService);
  private readonly messages = inject(MessageService);
  protected meta(s: string) { return PURCHASE_STATUS_META[s as PurchaseStatus] ?? PURCHASE_STATUS_META.Rfq; }
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly statusChips: { key: PurchaseStatus; label: string }[] = [
    { key: 'Rfq', label: 'RFQ' }, { key: 'Sent', label: 'Sent' }, { key: 'Purchase', label: 'Purchase Order' }, { key: 'Received', label: 'Received' }, { key: 'Cancelled', label: 'Cancelled' }
  ];

  protected search = '';
  protected readonly rows = signal<PurchaseOrder[]>([]);
  protected readonly statusFilter = signal<PurchaseStatus | null>(null);

  protected editorVisible = false;
  protected readonly editing = signal<PurchaseOrder | null>(null);
  protected head = this.blankHead();
  protected readonly lines = signal<EditLine[]>([]);

  constructor() { this.reload(); }
  reload() { this.svc.purchaseOrders(this.statusFilter(), this.search || null).subscribe((r) => this.rows.set(r)); }
  private timer: ReturnType<typeof setTimeout> | null = null;
  onSearch() { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => this.reload(), 250); }
  setStatus(s: PurchaseStatus | null) { this.statusFilter.set(s); this.reload(); }

  openNew() {
    this.editing.set(null); this.head = this.blankHead(); this.lines.set([]); this.editorVisible = true;
  }
  openEdit(p: PurchaseOrder) {
    this.editing.set(p);
    this.head = { vendor: p.vendor, vendorEmail: p.vendorEmail ?? '', responsible: p.responsible ?? '', orderDate: p.orderDate ? new Date(p.orderDate) : new Date(), expectedDate: p.expectedDate ? new Date(p.expectedDate) : null };
    this.lines.set(p.lines.map((l) => ({ product: l.product, description: l.description ?? null, quantity: l.quantity, unitPrice: l.unitPrice, taxPercent: l.taxPercent })));
    this.editorVisible = true;
  }

  addLine() { this.lines.set([...this.lines(), { product: '', description: null, quantity: 1, unitPrice: 0, taxPercent: 18 }]); }
  removeLine(i: number) { const l = [...this.lines()]; l.splice(i, 1); this.lines.set(l); }
  touch() { this.lines.set([...this.lines()]); }
  lineSubtotal(l: EditLine): number { return Math.round((l.quantity || 0) * (l.unitPrice || 0) * 100) / 100; }
  totals() {
    const untaxed = this.lines().reduce((a, l) => a + this.lineSubtotal(l), 0);
    const tax = this.lines().reduce((a, l) => a + this.lineSubtotal(l) * (l.taxPercent || 0) / 100, 0);
    return { untaxed: Math.round(untaxed), tax: Math.round(tax), total: Math.round(untaxed + tax) };
  }

  save() {
    if (!this.head.vendor.trim()) { this.messages.add({ severity: 'warn', summary: 'Vendor is required' }); return; }
    const body: Partial<PurchaseOrder> = {
      vendor: this.head.vendor.trim(), vendorEmail: this.head.vendorEmail || null, responsible: this.head.responsible || null,
      orderDate: this.toIso(this.head.orderDate) as string, expectedDate: this.toIso(this.head.expectedDate),
      lines: this.lines().filter((l) => l.product.trim()) as unknown as PurchaseLine[]
    };
    const e = this.editing();
    const obs = e ? this.svc.updatePo(e.id, body) : this.svc.createPo(body);
    obs.subscribe((p) => { this.editing.set(p); this.reload(); this.messages.add({ severity: 'success', summary: e ? 'Saved' : `Created ${p.number}` }); });
  }

  doAction(action: 'send' | 'confirm' | 'receive' | 'cancel' | 'draft') {
    const e = this.editing();
    if (!e) { this.messages.add({ severity: 'warn', summary: 'Save the RFQ first' }); return; }
    this.svc.poAction(e.id, action).subscribe((p) => {
      this.editing.set(p); this.reload();
      const label = { send: 'RFQ sent', confirm: 'Purchase confirmed', receive: 'Products received', cancel: 'Cancelled', draft: 'Reset to draft' }[action];
      this.messages.add({ severity: 'success', summary: label });
    });
  }

  private toIso(d: Date | null): string | null { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; }
  private blankHead() { return { vendor: '', vendorEmail: '', responsible: '' as string, orderDate: new Date() as Date | null, expectedDate: null as Date | null }; }
}
