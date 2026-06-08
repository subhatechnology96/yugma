import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SalesService } from '../sales.service';
import { Product, QUOTE_STATUS_META, Quotation, QuotationLine, QuotationStatus } from '../models';

const TEAM = ['Mitchell Admin', 'Marc Demo', 'Priya Sharma'];

interface EditLine { productCode: string | null; product: string; description: string | null; quantity: number; unitPrice: number; taxPercent: number; }

@Component({
  selector: 'app-quotations',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    ButtonModule, DialogModule, TableModule, SelectModule, InputTextModule, InputNumberModule, DatePickerModule, TooltipModule, AutoCompleteModule,
    PageHeaderComponent, StatusPillComponent, InrPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Sales" [title]="title()" [subtitle]="subtitle()">
      <input pInputText [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New" (click)="openNew()"></button>
    </app-page-header>

    <!-- status filter chips -->
    <div class="flex flex-wrap items-center gap-1.5 mb-3">
      <button class="chip" [class.chip-on]="!statusFilter()" (click)="setStatus(null)">All</button>
      @for (s of statusChips; track s.key) {
        <button class="chip" [class.chip-on]="statusFilter() === s.key" (click)="setStatus(s.key)">{{ s.label }}</button>
      }
    </div>

    <div class="card p-0 overflow-hidden">
      <p-table [value]="rows()" [rowHover]="true" [paginator]="rows().length > 15" [rows]="15" responsiveLayout="scroll">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-[11px] !uppercase !text-surface-500">Number</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Customer</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Order date</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Salesperson</th>
            <th class="!text-[11px] !uppercase !text-surface-500">Status</th>
            <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Total</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-q>
          <tr class="cursor-pointer" (click)="openEdit(q)">
            <td class="font-medium text-sm">{{ q.number }}</td>
            <td class="text-sm">{{ q.customer }}</td>
            <td class="text-sm text-surface-500">{{ q.orderDate | date: 'dd MMM yyyy' }}</td>
            <td class="text-sm text-surface-500">{{ q.salesperson || '—' }}</td>
            <td><app-status-pill [tone]="meta(q.status).tone">{{ meta(q.status).label }}</app-status-pill></td>
            <td class="text-right font-semibold tabular-nums text-sm">{{ q.total | inr }}</td>
            <td class="text-right"><i class="pi pi-angle-right text-surface-300"></i></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="7" class="py-12 text-center text-surface-400 text-sm">No {{ mode() === 'orders' ? 'sales orders' : 'quotations' }} yet.</td></tr></ng-template>
      </p-table>
    </div>

    <!-- ───── Quotation editor ───── -->
    <p-dialog [(visible)]="editorVisible" [modal]="true" [style]="{ width: '64rem' }" styleClass="!max-w-[96vw]" [draggable]="false" [dismissableMask]="false">
      <ng-template pTemplate="header">
        <div class="flex items-center gap-3">
          <span class="text-lg font-semibold">{{ editing()?.number || 'New Quotation' }}</span>
          @if (editing(); as e) { <app-status-pill [tone]="statusMeta[e.status].tone">{{ statusMeta[e.status].label }}</app-status-pill> }
        </div>
      </ng-template>

      <!-- status workflow -->
      <div class="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-surface-100 dark:border-surface-800">
        @if (editing()?.status !== 'SalesOrder' && editing()?.status !== 'Cancelled') {
          <button pButton size="small" icon="pi pi-send" label="Send by Email" severity="secondary" outlined (click)="doAction('send')" [disabled]="!editing()"></button>
          <button pButton size="small" icon="pi pi-check" label="Confirm" (click)="doAction('confirm')" [disabled]="!editing()"></button>
        }
        @if (editing()?.status === 'SalesOrder') {
          <span class="text-xs text-emerald-600 inline-flex items-center gap-1"><i class="pi pi-check-circle"></i> Confirmed sales order</span>
        }
        @if (editing() && editing()?.status !== 'Cancelled') {
          <button pButton size="small" icon="pi pi-times" label="Cancel" severity="danger" text (click)="doAction('cancel')"></button>
        }
        @if (editing()?.status === 'Cancelled') {
          <button pButton size="small" icon="pi pi-refresh" label="Set to Draft" severity="secondary" outlined (click)="doAction('draft')"></button>
        }
      </div>

      <!-- header fields -->
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div><label class="lbl">Customer *</label><input pInputText [(ngModel)]="head.customer" class="w-full" /></div>
        <div><label class="lbl">Email</label><input pInputText [(ngModel)]="head.customerEmail" class="w-full" /></div>
        <div><label class="lbl">Salesperson</label><p-select [(ngModel)]="head.salesperson" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true"></p-select></div>
        <div><label class="lbl">Order date</label><p-datepicker [(ngModel)]="head.orderDate" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        <div><label class="lbl">Expiration</label><p-datepicker [(ngModel)]="head.expiryDate" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        <div><label class="lbl">Payment terms</label><p-select [(ngModel)]="head.paymentTerms" [options]="termsOptions" class="w-full"></p-select></div>
      </div>

      <!-- order lines -->
      <div class="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden mb-3">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-surface-50 dark:bg-surface-900/40 text-[11px] uppercase text-surface-500">
              <th class="text-left font-medium px-3 py-2 w-[34%]">Product</th>
              <th class="text-left font-medium px-3 py-2">Description</th>
              <th class="text-right font-medium px-3 py-2 w-20">Qty</th>
              <th class="text-right font-medium px-3 py-2 w-28">Unit Price</th>
              <th class="text-right font-medium px-3 py-2 w-16">Tax %</th>
              <th class="text-right font-medium px-3 py-2 w-28">Subtotal</th>
              <th class="w-8"></th>
            </tr>
          </thead>
          <tbody>
            @for (l of lines(); track $index; let i = $index) {
              <tr class="border-t border-surface-100 dark:border-surface-800">
                <td class="px-2 py-1.5">
                  <p-select [(ngModel)]="l.product" [options]="productOptions()" optionLabel="label" optionValue="value" [filter]="true"
                    [editable]="true" placeholder="Select a product" class="w-full" (onChange)="onPickProduct(l, $event.value)"></p-select>
                </td>
                <td class="px-2 py-1.5"><input pInputText [(ngModel)]="l.description" class="w-full !text-sm" placeholder="—" /></td>
                <td class="px-2 py-1.5"><p-inputNumber [(ngModel)]="l.quantity" [min]="0" [minFractionDigits]="0" [maxFractionDigits]="2" inputStyleClass="!text-right !w-16" (onInput)="touch()"></p-inputNumber></td>
                <td class="px-2 py-1.5"><p-inputNumber [(ngModel)]="l.unitPrice" [min]="0" mode="decimal" [minFractionDigits]="2" inputStyleClass="!text-right !w-24" (onInput)="touch()"></p-inputNumber></td>
                <td class="px-2 py-1.5"><p-inputNumber [(ngModel)]="l.taxPercent" [min]="0" [max]="100" inputStyleClass="!text-right !w-12" (onInput)="touch()"></p-inputNumber></td>
                <td class="px-3 py-1.5 text-right tabular-nums font-medium">{{ lineSubtotal(l) | inr }}</td>
                <td class="px-1 text-center"><button class="text-surface-300 hover:text-rose-500" (click)="removeLine(i)"><i class="pi pi-trash text-xs"></i></button></td>
              </tr>
            }
            @if (!lines().length) { <tr><td colspan="7" class="px-3 py-4 text-center text-surface-400 text-xs">No lines yet — add a product.</td></tr> }
          </tbody>
        </table>
        <div class="px-3 py-2 border-t border-surface-100 dark:border-surface-800">
          <button class="text-brand-600 text-xs hover:underline" (click)="addLine()"><i class="pi pi-plus text-[10px] mr-1"></i>Add a product</button>
        </div>
      </div>

      <!-- totals -->
      <div class="flex justify-end">
        <div class="w-72 space-y-1.5 text-sm">
          <div class="flex justify-between text-surface-500"><span>Untaxed Amount</span><span class="tabular-nums">{{ totals().untaxed | inr }}</span></div>
          <div class="flex justify-between text-surface-500"><span>Tax</span><span class="tabular-nums">{{ totals().tax | inr }}</span></div>
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
export class QuotationsComponent {
  private readonly svc = inject(SalesService);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);

  protected readonly statusMeta = QUOTE_STATUS_META;
  protected meta(status: string) { return QUOTE_STATUS_META[status as QuotationStatus] ?? QUOTE_STATUS_META.Quotation; }
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly termsOptions = ['Immediate', '15 Days', '30 Days', '45 Days', '60 Days'];
  protected readonly statusChips: { key: QuotationStatus; label: string }[] = [
    { key: 'Quotation', label: 'Quotation' }, { key: 'Sent', label: 'Sent' }, { key: 'SalesOrder', label: 'Sales Order' }, { key: 'Cancelled', label: 'Cancelled' }
  ];

  protected readonly mode = signal<'quotations' | 'orders'>('quotations');
  protected readonly title = computed(() => (this.mode() === 'orders' ? 'Sales Orders' : 'Quotations'));
  protected readonly subtitle = computed(() => this.mode() === 'orders'
    ? 'Confirmed orders ready for delivery and invoicing.'
    : 'Build professional quotations in a couple of clicks — pick products, send and confirm into a sales order.');

  protected search = '';
  protected readonly rows = signal<Quotation[]>([]);
  protected readonly statusFilter = signal<QuotationStatus | null>(null);
  protected readonly products = signal<Product[]>([]);
  protected readonly productOptions = computed(() => this.products().map((p) => ({ label: `[${p.code}] ${p.name}`, value: p.name })));

  protected editorVisible = false;
  protected readonly editing = signal<Quotation | null>(null);
  protected head = this.blankHead();
  protected readonly lines = signal<EditLine[]>([]);

  constructor() {
    this.svc.products().subscribe((p) => this.products.set(p));
    this.route.data.subscribe((d) => {
      this.mode.set((d['mode'] as 'quotations' | 'orders') ?? 'quotations');
      this.statusFilter.set(this.mode() === 'orders' ? 'SalesOrder' : null);
      this.reload();
    });
    // Deep-link from CRM "New Quotation"
    this.route.queryParams.subscribe((qp) => {
      if (qp['customer']) {
        setTimeout(() => this.openNew(qp['customer'], qp['email'] ?? '', qp['oppId'] ?? null), 0);
      }
    });
  }

  private reload() {
    this.svc.quotations({ status: this.statusFilter(), search: this.search || null }).subscribe((r) => {
      // In "orders" mode, always constrain to confirmed orders.
      this.rows.set(this.mode() === 'orders' ? r.filter((q) => q.status === 'SalesOrder') : r);
    });
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  onSearch() { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.reload(), 250); }

  setStatus(s: QuotationStatus | null) {
    if (this.mode() === 'orders') return; // locked to SalesOrder
    this.statusFilter.set(s);
    this.reload();
  }

  // ── editor ──
  openNew(customer = '', email = '', oppId: string | null = null) {
    this.editing.set(null);
    this.head = { ...this.blankHead(), customer, customerEmail: email, opportunityId: oppId };
    this.lines.set([]);
    this.editorVisible = true;
  }
  openEdit(q: Quotation) {
    this.editing.set(q);
    this.head = {
      customer: q.customer, customerEmail: q.customerEmail ?? '', salesperson: q.salesperson ?? '',
      orderDate: q.orderDate ? new Date(q.orderDate) : new Date(), expiryDate: q.expiryDate ? new Date(q.expiryDate) : null,
      paymentTerms: q.paymentTerms, opportunityId: q.opportunityId ?? null
    };
    this.lines.set(q.lines.map((l) => ({ productCode: l.productCode ?? null, product: l.product, description: l.description ?? null, quantity: l.quantity, unitPrice: l.unitPrice, taxPercent: l.taxPercent })));
    this.editorVisible = true;
  }

  addLine() { this.lines.set([...this.lines(), { productCode: null, product: '', description: null, quantity: 1, unitPrice: 0, taxPercent: 15 }]); }
  removeLine(i: number) { const l = [...this.lines()]; l.splice(i, 1); this.lines.set(l); }
  touch() { this.lines.set([...this.lines()]); }

  onPickProduct(line: EditLine, value: string) {
    const p = this.products().find((x) => x.name === value);
    if (p) { line.productCode = p.code; line.unitPrice = p.unitPrice; line.taxPercent = p.taxPercent; line.description = line.description || p.name; }
    this.touch();
  }

  lineSubtotal(l: EditLine): number { return Math.round((l.quantity || 0) * (l.unitPrice || 0) * 100) / 100; }
  totals() {
    const untaxed = this.lines().reduce((a, l) => a + this.lineSubtotal(l), 0);
    const tax = this.lines().reduce((a, l) => a + this.lineSubtotal(l) * (l.taxPercent || 0) / 100, 0);
    return { untaxed: Math.round(untaxed), tax: Math.round(tax), total: Math.round(untaxed + tax) };
  }

  save() {
    if (!this.head.customer.trim()) { this.messages.add({ severity: 'warn', summary: 'Customer is required' }); return; }
    const body: Partial<Quotation> & { customer: string } = {
      customer: this.head.customer.trim(),
      customerEmail: this.head.customerEmail || null,
      salesperson: this.head.salesperson || null,
      orderDate: this.toIso(this.head.orderDate) as string,
      expiryDate: this.toIso(this.head.expiryDate),
      paymentTerms: this.head.paymentTerms,
      opportunityId: this.head.opportunityId,
      lines: this.lines().filter((l) => l.product.trim()).map((l) => ({
        productCode: l.productCode, product: l.product.trim(), description: l.description, quantity: l.quantity || 1, unitPrice: l.unitPrice || 0, taxPercent: l.taxPercent || 0
      })) as unknown as QuotationLine[]
    };
    const editing = this.editing();
    const obs = editing ? this.svc.updateQuotation(editing.id, body) : this.svc.createQuotation(body);
    obs.subscribe((q) => { this.editing.set(q); this.reload(); this.messages.add({ severity: 'success', summary: editing ? 'Saved' : `Created ${q.number}` }); });
  }

  doAction(action: 'send' | 'confirm' | 'cancel' | 'draft') {
    const e = this.editing();
    if (!e) { this.messages.add({ severity: 'warn', summary: 'Save the quotation first' }); return; }
    const map = { send: this.svc.sendQuotation(e.id), confirm: this.svc.confirmQuotation(e.id), cancel: this.svc.cancelQuotation(e.id), draft: this.svc.draftQuotation(e.id) };
    map[action].subscribe((q) => {
      this.editing.set(q); this.reload();
      const label = { send: 'Sent', confirm: 'Confirmed — sales order created', cancel: 'Cancelled', draft: 'Reset to draft' }[action];
      this.messages.add({ severity: 'success', summary: label });
    });
  }

  private toIso(d: Date | null): string | null { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; }
  private blankHead() {
    return { customer: '', customerEmail: '', salesperson: '' as string, orderDate: new Date() as Date | null, expiryDate: null as Date | null, paymentTerms: '30 Days', opportunityId: null as string | null };
  }
}
