export type FinanceDocKind = 'CustomerInvoice' | 'VendorBill';
export type FinanceDocStatus = 'draft' | 'posted' | 'paid' | 'cancelled';
export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'reimbursed' | 'refused';
export type SignatureStatus = 'none' | 'pending' | 'signed';

export interface FinanceDoc {
  id: string;
  number: string;
  kind: FinanceDocKind;
  status: FinanceDocStatus;
  late: boolean;
  partner: string;
  reference?: string | null;
  issueDate: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  notes?: string | null;
  createdAt: string;
}

export interface Expense {
  id: string; number: string; employee: string; category: string; description: string;
  date: string; amount: number; status: ExpenseStatus; notes?: string | null;
}

export interface BankTxn { id: string; date: string; label: string; amount: number; category: string; reconciled: boolean; }
export interface BankAccountDto {
  id: string; name: string; kind: 'Bank' | 'Cash'; currency: string; balance: number; toReconcile: number; transactions: BankTxn[];
}

export interface FinanceFile {
  id: string; name: string; category: string; owner: string; signatureStatus: SignatureStatus; signer?: string | null; signedAt?: string | null; createdAt: string;
}

export interface DocCard {
  toValidate: { count: number; amount: number };
  unpaid: { count: number; amount: number };
  late: { count: number; amount: number };
  total: number;
  aging: { label: string; amount: number }[];
}
export interface AccountCard {
  name: string; balance: number; lastStatement: number; payments: number; miscOperations: number; toReconcile: number; transactions?: number; trend: number[];
}
export interface FinanceDashboard {
  currency: string;
  customerInvoices: DocCard;
  vendorBills: DocCard;
  bank: AccountCard;
  cash: AccountCard;
}

export interface FinanceAnalytics {
  currency: string;
  kpis: { income: number; spend: number; profit: number; receivable: number; payable: number; expenses: number };
  revenue: { month: string; income: number; spend: number }[];
  expenseByCategory: { category: string; amount: number }[];
  topCustomers: { partner: string; total: number; paid: number }[];
}

export const DOC_STATUS_TONE: Record<FinanceDocStatus, string> = {
  draft: 'bg-surface-100 text-surface-500 dark:bg-surface-800',
  posted: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  paid: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  cancelled: 'bg-surface-100 text-surface-400 dark:bg-surface-800 line-through'
};
export const EXPENSE_STATUS_TONE: Record<ExpenseStatus, string> = {
  draft: 'bg-surface-100 text-surface-500 dark:bg-surface-800',
  submitted: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  approved: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  reimbursed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  refused: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
};
