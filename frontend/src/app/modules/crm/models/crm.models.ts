// Wire models mirroring the backend CRM DTOs (Yugma.Crm.Application.Crm.*).

export type LeadStatus = 'new' | 'working' | 'qualified' | 'unqualified' | 'converted';
export type DealStatus = 'open' | 'won' | 'lost';
export type AccountStatus = 'prospect' | 'customer' | 'churned';
export type ActivityType = 'call' | 'email' | 'meeting' | 'task';
export type ActivityStatus = 'open' | 'done';
export type CrmEntityType = 'lead' | 'account' | 'contact' | 'deal';

export const LEAD_SOURCES = ['Website', 'Referral', 'Campaign', 'Event', 'Cold call', 'Partner', 'Inbound', 'Other'] as const;

export interface Lead {
  id: string;
  code: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  score: number;
  owner: string;
  convertedDealId?: string | null;
  convertedAccountId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface Account {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  size?: string | null;
  annualRevenue: number;
  owner: string;
  status: AccountStatus;
  customerRef?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface Contact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  title?: string | null;
  accountId: string;
  accountName: string;
  owner: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface DealStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
}

export interface Deal {
  id: string;
  code: string;
  name: string;
  accountId: string;
  accountName: string;
  contactId?: string | null;
  contactName?: string | null;
  value: number;
  stageId: string;
  stageName: string;
  status: DealStatus;
  probability: number;
  closeDate: string;
  owner: string;
  lastActivityAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PipelineStage {
  stageId: string;
  name: string;
  order: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  totalValue: number;
  count: number;
  deals: Deal[];
}

export interface Pipeline {
  stages: PipelineStage[];
  totalOpenValue: number;
  weightedValue: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  dueAt: string;
  completedAt?: string | null;
  status: ActivityStatus;
  relatedToType: CrmEntityType;
  relatedToId: string;
  owner: string;
  reminderAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface Note {
  id: string;
  body: string;
  relatedToType: CrmEntityType;
  relatedToId: string;
  author: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ConvertLeadResult {
  leadId: string;
  accountId: string;
  contactId: string;
  dealId: string;
  dealCode: string;
}
