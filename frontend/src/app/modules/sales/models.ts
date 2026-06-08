export type SalesStage = 'New' | 'Qualified' | 'Proposition' | 'Won' | 'Lost';
export type QuotationStatus = 'Quotation' | 'Sent' | 'SalesOrder' | 'Cancelled';

export interface SalesActivity {
  index: number;
  kind: string; // call | meeting | email | quotation | todo | note | stage
  summary: string;
  dueDate?: string | null;
  done: boolean;
  by?: string | null;
  at: string;
}

export interface Opportunity {
  id: string;
  code: string;
  name: string;
  stage: SalesStage;
  customer: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  salesperson?: string | null;
  expectedRevenue: number;
  probability: number;
  priority: number; // 0–3
  expectedClosing?: string | null;
  source?: string | null;
  description?: string | null;
  tags: string[];
  createdAt: string;
  activities: SalesActivity[];
}

export interface CrmSummary {
  totalOpen: number;
  pipelineValue: number;
  weightedValue: number;
  won: number;
  wonValue: number;
  lost: number;
  byStage: { stage: SalesStage; count: number; value: number }[];
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unitPrice: number;
  taxPercent: number;
  onHand: number;
  uom: string;
  description?: string | null;
  active: boolean;
}

export interface QuotationLine {
  productCode?: string | null;
  product: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
}

export interface Quotation {
  id: string;
  number: string;
  status: QuotationStatus;
  customer: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  orderDate: string;
  expiryDate?: string | null;
  pricelist: string;
  paymentTerms: string;
  salesperson?: string | null;
  opportunityId?: string | null;
  notes?: string | null;
  untaxedAmount: number;
  taxAmount: number;
  total: number;
  lines: QuotationLine[];
}

export interface SalesSummary {
  pipelineValue: number;
  openOpportunities: number;
  wonRevenue: number;
  quotationsOpen: number;
  quotationsValue: number;
  salesOrders: number;
  salesOrdersValue: number;
  products: number;
  stageFunnel: { stage: SalesStage; count: number; value: number }[];
  recentQuotes: Quotation[];
  topOpportunities: Opportunity[];
}

export const SALES_STAGES: { key: SalesStage; label: string; dot: string; bar: string }[] = [
  { key: 'New', label: 'New', dot: 'bg-surface-400', bar: 'bg-surface-400' },
  { key: 'Qualified', label: 'Qualified', dot: 'bg-brand-400', bar: 'bg-brand-500' },
  { key: 'Proposition', label: 'Proposition', dot: 'bg-amber-400', bar: 'bg-amber-500' },
  { key: 'Won', label: 'Won', dot: 'bg-emerald-500', bar: 'bg-emerald-500' }
];

export const QUOTE_STATUS_META: Record<QuotationStatus, { label: string; tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  Quotation: { label: 'Quotation', tone: 'neutral' },
  Sent: { label: 'Quotation Sent', tone: 'info' },
  SalesOrder: { label: 'Sales Order', tone: 'success' },
  Cancelled: { label: 'Cancelled', tone: 'danger' }
};

export const ACTIVITY_META: Record<string, { label: string; icon: string }> = {
  call: { label: 'Call', icon: 'pi-phone' },
  meeting: { label: 'Meeting', icon: 'pi-calendar' },
  email: { label: 'Email', icon: 'pi-envelope' },
  quotation: { label: 'Quotation', icon: 'pi-file-edit' },
  todo: { label: 'To-do', icon: 'pi-check-circle' },
  note: { label: 'Note', icon: 'pi-comment' },
  stage: { label: 'Stage', icon: 'pi-flag' }
};
