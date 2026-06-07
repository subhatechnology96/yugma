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
import { EXPENSE_STATUS_TONE, Expense } from '../models';

@Component({
  selector: 'app-finance-expenses',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, DatePickerModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Finance" title="Expenses" subtitle="Employee expense claims — submit, approve and reimburse.">
      <button pButton severity="secondary" outlined icon="pi pi-plus" label="New expense" (click)="openCreate()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[22px] leading-tight font-semibold mt-0.5 tabular-nums">{{ money(s.value) }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="card overflow-hidden">
      <p-table [value]="expenses()" responsiveLayout="scroll" [rowHover]="true" [paginator]="expenses().length > 14" [rows]="14" class="p-1">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase !text-surface-500">Number</th>
            <th class="!text-xs !uppercase !text-surface-500">Employee</th>
            <th class="!text-xs !uppercase !text-surface-500">Category</th>
            <th class="!text-xs !uppercase !text-surface-500">Date</th>
            <th class="!text-xs !uppercase !text-surface-500 !text-right">Amount</th>
            <th class="!text-xs !uppercase !text-surface-500">Status</th>
            <th class="!w-44"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-e>
          <tr>
            <td class="font-medium text-sm">{{ e.number }}</td>
            <td class="text-sm">{{ e.employee }}</td>
            <td class="text-sm">{{ e.category }}<span class="text-[11px] text-surface-400"> · {{ e.description }}</span></td>
            <td class="text-sm text-surface-500">{{ e.date | date: 'mediumDate' }}</td>
            <td class="text-right tabular-nums font-medium">{{ money(e.amount) }}</td>
            <td><span class="text-[11px] px-2 py-0.5 rounded-full capitalize" [class]="tone(e.status)">{{ e.status }}</span></td>
            <td (click)="$event.stopPropagation()" class="text-right whitespace-nowrap">
              @if (e.status === 'submitted') {
                <button pButton size="small" text class="!text-[11px] !py-0 !text-rose-500" label="Refuse" (click)="act(e, 'refuse')"></button>
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" label="Approve" (click)="act(e, 'approve')"></button>
              } @else if (e.status === 'approved') {
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" icon="pi pi-wallet" label="Reimburse" (click)="act(e, 'reimburse')"></button>
              } @else if (e.status === 'draft') {
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" label="Submit" (click)="act(e, 'submit')"></button>
              } @else if (e.status === 'reimbursed') {
                <span class="text-[11px] text-emerald-500"><i class="pi pi-check-circle"></i> Reimbursed</span>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="7" class="py-10 text-center text-surface-500">No expenses.</td></tr></ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '32rem' }" header="New expense" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div>
          <label class="text-xs font-medium text-surface-600">Employee</label>
          <input pInputText [(ngModel)]="form.employee" class="w-full mt-1 !rounded-lg" placeholder="Name" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Category</label>
          <p-select [options]="categories" [(ngModel)]="form.category" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Amount</label>
          <p-inputNumber [(ngModel)]="form.amount" [min]="0" mode="currency" currency="INR" locale="en-IN" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Date</label>
          <p-datePicker [(ngModel)]="form.date" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Description</label>
          <input pInputText [(ngModel)]="form.description" class="w-full mt-1 !rounded-lg" placeholder="What was it for?" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Submit expense" [disabled]="!form.employee.trim() || !form.amount" (click)="submitCreate()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class ExpensesComponent {
  private readonly svc = inject(FinanceService);
  private readonly messages = inject(MessageService);

  protected readonly expenses = signal<Expense[]>([]);
  protected readonly categories = ['Travel', 'Meals', 'Accommodation', 'Software', 'Office supplies', 'Client entertainment', 'Other'];

  createVisible = false;
  form = this.blank();

  constructor() { this.reload(); }
  reload() { this.svc.expenses().subscribe((e) => this.expenses.set(e)); }

  protected readonly stats = computed(() => {
    const e = this.expenses();
    const sum = (f: (x: Expense) => boolean) => e.filter(f).reduce((a, x) => a + x.amount, 0);
    return [
      { label: 'To approve', value: sum((x) => x.status === 'submitted'), caption: 'awaiting review' },
      { label: 'Approved', value: sum((x) => x.status === 'approved'), caption: 'to reimburse' },
      { label: 'Reimbursed', value: sum((x) => x.status === 'reimbursed'), caption: 'paid out' },
      { label: 'Total', value: sum((x) => x.status !== 'refused'), caption: 'all claims' }
    ];
  });

  act(e: Expense, action: 'submit' | 'approve' | 'reimburse' | 'refuse') {
    this.svc.expenseAction(e.id, action).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Updated', detail: `${e.number} · ${action}` }); this.reload(); });
  }

  openCreate() { this.form = this.blank(); this.createVisible = true; }
  submitCreate() {
    const f = this.form;
    this.svc.createExpense({ employee: f.employee.trim(), category: f.category, description: f.description?.trim(), amount: f.amount, date: f.date ? this.iso(f.date) : null })
      .subscribe({ next: () => { this.messages.add({ severity: 'success', summary: 'Expense submitted' }); this.createVisible = false; this.reload(); }, error: () => this.messages.add({ severity: 'error', summary: 'Submit failed' }) });
  }

  tone(s: string): string { return (EXPENSE_STATUS_TONE as Record<string, string>)[s] ?? ''; }
  money(n: number): string { return '₹' + Math.round(n).toLocaleString('en-IN'); }
  private iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  private blank() { return { employee: '', category: 'Travel', amount: 0, date: new Date() as Date | null, description: '' }; }
}
