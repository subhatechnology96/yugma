import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { FinanceService } from '../finance.service';
import { DOC_STATUS_TONE, FinanceDoc, FinanceDocKind } from '../models';

@Component({
  selector: 'app-finance-invoicing',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, DatePickerModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Finance" title="Invoicing" subtitle="Customer invoices and vendor bills — validate, send and register payments.">
      <button pButton severity="secondary" outlined icon="pi pi-plus" [label]="kind() === 'CustomerInvoice' ? 'New invoice' : 'New bill'" (click)="openCreate()"></button>
    </app-page-header>

    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="inline-flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <button class="px-3 py-1.5 text-sm transition" [class]="kind() === 'CustomerInvoice' ? 'bg-surface-800 text-white dark:bg-surface-100 dark:text-surface-900' : 'text-surface-500'" (click)="setKind('CustomerInvoice')">Customer Invoices</button>
        <button class="px-3 py-1.5 text-sm transition" [class]="kind() === 'VendorBill' ? 'bg-surface-800 text-white dark:bg-surface-100 dark:text-surface-900' : 'text-surface-500'" (click)="setKind('VendorBill')">Vendor Bills</button>
      </div>
      <div class="flex items-center gap-1.5 ml-2">
        @for (s of statusFilters; track s.value) {
          <button class="px-2.5 py-1 rounded-full text-xs border transition"
            [class]="status() === s.value ? 'bg-surface-800 text-white border-surface-800 dark:bg-surface-100 dark:text-surface-900' : 'border-surface-200 dark:border-surface-700 text-surface-500'"
            (click)="setStatus(s.value)">{{ s.label }}</button>
        }
      </div>
    </div>

    <div class="card overflow-hidden">
      <p-table [value]="docs()" responsiveLayout="scroll" [rowHover]="true" [paginator]="docs().length > 14" [rows]="14" class="p-1">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase !text-surface-500">Number</th>
            <th class="!text-xs !uppercase !text-surface-500">{{ kind() === 'CustomerInvoice' ? 'Customer' : 'Vendor' }}</th>
            <th class="!text-xs !uppercase !text-surface-500">Invoice date</th>
            <th class="!text-xs !uppercase !text-surface-500">Due date</th>
            <th class="!text-xs !uppercase !text-surface-500 !text-right">Total</th>
            <th class="!text-xs !uppercase !text-surface-500 !text-right">Due</th>
            <th class="!text-xs !uppercase !text-surface-500">Status</th>
            <th class="!w-40"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-d>
          <tr>
            <td class="font-medium text-sm">{{ d.number }}</td>
            <td class="text-sm">{{ d.partner }}<span class="text-[11px] text-surface-400"> {{ d.reference ? '· ' + d.reference : '' }}</span></td>
            <td class="text-sm text-surface-500">{{ d.issueDate | date: 'mediumDate' }}</td>
            <td class="text-sm" [class.text-rose-500]="d.late">{{ d.dueDate | date: 'mediumDate' }}</td>
            <td class="text-right tabular-nums">{{ money(d.total) }}</td>
            <td class="text-right tabular-nums" [class.text-rose-500]="d.late">{{ money(d.amountDue) }}</td>
            <td>
              <span class="text-[11px] px-2 py-0.5 rounded-full" [class]="tone(d.status)">{{ statusLabel(d) }}</span>
            </td>
            <td (click)="$event.stopPropagation()" class="text-right">
              @if (d.status === 'draft') {
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" label="Validate" (click)="validate(d)"></button>
              } @else if (d.status === 'posted') {
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" icon="pi pi-wallet" label="Register payment" (click)="pay(d)"></button>
              } @else if (d.status === 'paid') {
                <span class="text-[11px] text-emerald-500"><i class="pi pi-check-circle"></i> Paid</span>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="8" class="py-10 text-center text-surface-500">No documents.</td></tr></ng-template>
      </p-table>
    </div>

    <!-- New document -->
    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="kind() === 'CustomerInvoice' ? 'New customer invoice' : 'New vendor bill'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">{{ kind() === 'CustomerInvoice' ? 'Customer' : 'Vendor' }}</label>
          <input pInputText [(ngModel)]="form.partner" class="w-full mt-1 !rounded-lg" placeholder="Name" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Amount (untaxed)</label>
          <p-inputNumber [(ngModel)]="form.amount" [min]="0" mode="currency" currency="INR" locale="en-IN" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Due date</label>
          <p-datePicker [(ngModel)]="form.due" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Reference (optional)</label>
          <input pInputText [(ngModel)]="form.reference" class="w-full mt-1 !rounded-lg" placeholder="PO / SO reference" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Create draft" [disabled]="!form.partner.trim() || !form.amount" (click)="submitCreate()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class InvoicingComponent {
  private readonly svc = inject(FinanceService);
  private readonly messages = inject(MessageService);

  protected readonly kind = signal<FinanceDocKind>('CustomerInvoice');
  protected readonly status = signal<string | null>(null);
  protected readonly docs = signal<FinanceDoc[]>([]);
  protected readonly statusFilters = [
    { label: 'All', value: null }, { label: 'To validate', value: 'draft' }, { label: 'Open', value: 'posted' }, { label: 'Late', value: 'late' }, { label: 'Paid', value: 'paid' }
  ];

  createVisible = false;
  form = this.blank();

  constructor() { this.reload(); }

  reload() { this.svc.documents({ kind: this.kind(), status: this.status() }).subscribe((d) => this.docs.set(d)); }
  setKind(k: FinanceDocKind) { this.kind.set(k); this.reload(); }
  setStatus(s: string | null) { this.status.set(s); this.reload(); }

  validate(d: FinanceDoc) {
    this.svc.validate(d.id).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Validated', detail: d.number }); this.reload(); });
  }
  pay(d: FinanceDoc) {
    this.svc.pay(d.id).subscribe((u) => { this.messages.add({ severity: 'success', summary: 'Payment registered', detail: `${d.number} · ${this.money(u.amountPaid)}` }); this.reload(); });
  }

  openCreate() { this.form = this.blank(); this.createVisible = true; }
  submitCreate() {
    const f = this.form;
    this.svc.createDocument({ kind: this.kind(), partner: f.partner.trim(), amount: f.amount, dueDate: f.due ? this.iso(f.due) : null, reference: f.reference?.trim() || null } as never)
      .subscribe({ next: () => { this.messages.add({ severity: 'success', summary: 'Draft created' }); this.createVisible = false; this.reload(); }, error: () => this.messages.add({ severity: 'error', summary: 'Create failed' }) });
  }

  tone(s: string): string { return (DOC_STATUS_TONE as Record<string, string>)[s] ?? ''; }
  statusLabel(d: FinanceDoc): string {
    if (d.late) return 'Late';
    return ({ draft: 'To validate', posted: 'Open', paid: 'Paid', cancelled: 'Cancelled' } as Record<string, string>)[d.status] ?? d.status;
  }
  money(n: number): string { return '₹' + Math.round(n).toLocaleString('en-IN'); }
  private iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  private blank() { return { partner: '', amount: 0, due: null as Date | null, reference: '' }; }
}
