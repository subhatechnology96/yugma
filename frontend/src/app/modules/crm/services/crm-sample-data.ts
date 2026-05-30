import { Account, Activity, Contact, Deal, DealStage, Lead, Note } from '../models/crm.models';

// In-memory sample data used as a graceful fallback when the /api/crm backend is
// unavailable (e.g. local dev without PostgreSQL). Mirrors the backend DataSeeder so the
// UI is fully demoable offline; once the API is reachable, live data takes over.

export const SAMPLE_STAGES: DealStage[] = [
  { id: 'st-lead', name: 'Lead', order: 1, probability: 10, isWon: false, isLost: false },
  { id: 'st-qual', name: 'Qualified', order: 2, probability: 30, isWon: false, isLost: false },
  { id: 'st-prop', name: 'Proposal', order: 3, probability: 55, isWon: false, isLost: false },
  { id: 'st-nego', name: 'Negotiation', order: 4, probability: 75, isWon: false, isLost: false },
  { id: 'st-won', name: 'Won', order: 5, probability: 100, isWon: true, isLost: false },
  { id: 'st-lost', name: 'Lost', order: 6, probability: 0, isWon: false, isLost: true }
];

export const SAMPLE_ACCOUNTS: Account[] = [
  { id: 'acc-tata', name: 'Tata Digital', industry: 'Technology', website: 'tatadigital.com', phone: '+91 22 6661 8000', size: '1000+', annualRevenue: 480_000_000, owner: 'Vikram Singh', status: 'customer', createdAt: '2026-01-10T09:00:00Z' },
  { id: 'acc-ril', name: 'Reliance Retail', industry: 'Retail', website: 'relianceretail.com', phone: '+91 22 3555 5000', size: '1000+', annualRevenue: 920_000_000, owner: 'Meera Krishnan', status: 'customer', createdAt: '2026-01-18T09:00:00Z' },
  { id: 'acc-infy', name: 'Infosys BPM', industry: 'BPO', website: 'infosysbpm.com', phone: '+91 80 2852 0261', size: '1000+', annualRevenue: 310_000_000, owner: 'Arjun Trivedi', status: 'prospect', createdAt: '2026-02-02T09:00:00Z' },
  { id: 'acc-zom', name: 'Zomato', industry: 'Foodtech', website: 'zomato.com', phone: '+91 80 4974 6300', size: '501-1000', annualRevenue: 180_000_000, owner: 'Vikram Singh', status: 'prospect', createdAt: '2026-02-20T09:00:00Z' },
  { id: 'acc-fkh', name: 'Flipkart Health+', industry: 'Healthtech', website: 'flipkarthealth.in', phone: '+91 80 4900 1000', size: '201-500', annualRevenue: 95_000_000, owner: 'Meera Krishnan', status: 'prospect', createdAt: '2026-03-05T09:00:00Z' },
  { id: 'acc-swg', name: 'Swiggy Instamart', industry: 'Q-commerce', website: 'swiggy.com', phone: '+91 80 6817 9777', size: '501-1000', annualRevenue: 140_000_000, owner: 'Arjun Trivedi', status: 'churned', createdAt: '2026-03-22T09:00:00Z' }
];

const acc = (id: string) => SAMPLE_ACCOUNTS.find((a) => a.id === id)!.name;

export const SAMPLE_CONTACTS: Contact[] = [
  { id: 'ct-1', fullName: 'Rohit Bansal', email: 'rohit.bansal@tatadigital.com', phone: '+91 98100 11223', title: 'VP Engineering', accountId: 'acc-tata', accountName: acc('acc-tata'), owner: 'Vikram Singh', isPrimary: true, createdAt: '2026-01-12T09:00:00Z' },
  { id: 'ct-2', fullName: 'Kavya Reddy', email: 'kavya.reddy@relianceretail.com', phone: '+91 98200 33445', title: 'Head of IT', accountId: 'acc-ril', accountName: acc('acc-ril'), owner: 'Meera Krishnan', isPrimary: true, createdAt: '2026-01-20T09:00:00Z' },
  { id: 'ct-3', fullName: 'Sanjay Gupta', email: 'sanjay.gupta@infosysbpm.com', phone: '+91 98300 55667', title: 'Director, Ops', accountId: 'acc-infy', accountName: acc('acc-infy'), owner: 'Arjun Trivedi', isPrimary: true, createdAt: '2026-02-04T09:00:00Z' },
  { id: 'ct-4', fullName: 'Neha Verma', email: 'neha.verma@zomato.com', phone: '+91 98400 77889', title: 'Product Lead', accountId: 'acc-zom', accountName: acc('acc-zom'), owner: 'Vikram Singh', isPrimary: true, createdAt: '2026-02-22T09:00:00Z' },
  { id: 'ct-5', fullName: 'Aman Khanna', email: 'aman.khanna@flipkarthealth.in', phone: '+91 98500 99001', title: 'CTO', accountId: 'acc-fkh', accountName: acc('acc-fkh'), owner: 'Meera Krishnan', isPrimary: true, createdAt: '2026-03-07T09:00:00Z' },
  { id: 'ct-6', fullName: 'Pooja Nair', email: 'pooja.nair@swiggy.com', phone: '+91 98600 22113', title: 'Procurement Manager', accountId: 'acc-swg', accountName: acc('acc-swg'), owner: 'Arjun Trivedi', isPrimary: true, createdAt: '2026-03-24T09:00:00Z' },
  { id: 'ct-7', fullName: 'Vivek Menon', email: 'vivek.menon@tatadigital.com', phone: '+91 98700 44225', title: 'Procurement Lead', accountId: 'acc-tata', accountName: acc('acc-tata'), owner: 'Vikram Singh', isPrimary: false, createdAt: '2026-01-14T09:00:00Z' },
  { id: 'ct-8', fullName: 'Ritika Shah', email: 'ritika.shah@relianceretail.com', phone: '+91 98800 66337', title: 'Finance Controller', accountId: 'acc-ril', accountName: acc('acc-ril'), owner: 'Meera Krishnan', isPrimary: false, createdAt: '2026-01-22T09:00:00Z' }
];

export const SAMPLE_LEADS: Lead[] = [
  { id: 'ld-1', code: 'LEAD-1001', fullName: 'Ananya Desai', company: 'PhonePe', email: 'ananya@phonepe.com', phone: '+91 99001 11223', source: 'Inbound', status: 'working', score: 88, owner: 'Vikram Singh', createdAt: '2026-05-12T09:00:00Z' },
  { id: 'ld-2', code: 'LEAD-1002', fullName: 'Karan Malhotra', company: 'Razorpay', email: 'karan@razorpay.com', phone: '+91 99002 22334', source: 'Website', status: 'new', score: 72, owner: 'Meera Krishnan', createdAt: '2026-05-14T09:00:00Z' },
  { id: 'ld-3', code: 'LEAD-1003', fullName: 'Sneha Pillai', company: 'Meesho', email: 'sneha@meesho.com', phone: '+91 99003 33445', source: 'Referral', status: 'qualified', score: 65, owner: 'Arjun Trivedi', createdAt: '2026-05-09T09:00:00Z' },
  { id: 'ld-4', code: 'LEAD-1004', fullName: 'Rahul Saxena', company: 'CRED', email: 'rahul@cred.club', phone: '+91 99004 44556', source: 'Event', status: 'qualified', score: 91, owner: 'Vikram Singh', createdAt: '2026-05-06T09:00:00Z' },
  { id: 'ld-5', code: 'LEAD-1005', fullName: 'Divya Iyer', company: 'Nykaa', email: 'divya@nykaa.com', phone: '+91 99005 55667', source: 'Campaign', status: 'new', score: 54, owner: 'Meera Krishnan', createdAt: '2026-05-15T09:00:00Z' },
  { id: 'ld-6', code: 'LEAD-1006', fullName: 'Manish Agarwal', company: 'Groww', email: 'manish@groww.in', phone: '+91 99006 66778', source: 'Cold call', status: 'unqualified', score: 40, owner: 'Arjun Trivedi', createdAt: '2026-05-04T09:00:00Z' },
  { id: 'ld-7', code: 'LEAD-1007', fullName: 'Tanya Kapoor', company: 'Urban Company', email: 'tanya@urbancompany.com', phone: '+91 99007 77889', source: 'Inbound', status: 'working', score: 77, owner: 'Vikram Singh', createdAt: '2026-05-18T09:00:00Z' },
  { id: 'ld-8', code: 'LEAD-1008', fullName: 'Sahil Mehta', company: 'Dream11', email: 'sahil@dream11.com', phone: '+91 99008 88990', source: 'Partner', status: 'qualified', score: 83, owner: 'Meera Krishnan', createdAt: '2026-05-11T09:00:00Z' },
  { id: 'ld-9', code: 'LEAD-1009', fullName: 'Ishita Roy', company: 'Lenskart', email: 'ishita@lenskart.com', phone: '+91 99009 99001', source: 'Website', status: 'new', score: 61, owner: 'Arjun Trivedi', createdAt: '2026-05-19T09:00:00Z' },
  { id: 'ld-10', code: 'LEAD-1010', fullName: 'Aakash Jain', company: 'BharatPe', email: 'aakash@bharatpe.com', phone: '+91 99010 11122', source: 'Referral', status: 'working', score: 58, owner: 'Vikram Singh', createdAt: '2026-05-20T09:00:00Z' },
  { id: 'ld-11', code: 'LEAD-1011', fullName: 'Ritu Sharma', company: 'Ola Electric', email: 'ritu@olaelectric.com', phone: '+91 99011 22233', source: 'Event', status: 'new', score: 69, owner: 'Meera Krishnan', createdAt: '2026-05-21T09:00:00Z' },
  { id: 'ld-12', code: 'LEAD-1012', fullName: 'Nikhil Rao', company: 'Unacademy', email: 'nikhil@unacademy.com', phone: '+91 99012 33344', source: 'Inbound', status: 'unqualified', score: 47, owner: 'Arjun Trivedi', createdAt: '2026-05-22T09:00:00Z' }
];

interface DealSeed { id: string; code: string; name: string; accId: string; value: number; stage: string; close: string; owner: string; }
const DEAL_SEEDS: DealSeed[] = [
  { id: 'dl-1', code: 'DEAL-1001', name: 'Tata Digital — Platform licence', accId: 'acc-tata', value: 12_500_000, stage: 'st-nego', close: '2026-06-20', owner: 'Vikram Singh' },
  { id: 'dl-2', code: 'DEAL-1002', name: 'Reliance Retail — POS rollout', accId: 'acc-ril', value: 28_000_000, stage: 'st-prop', close: '2026-07-05', owner: 'Meera Krishnan' },
  { id: 'dl-3', code: 'DEAL-1003', name: 'Infosys BPM — Workforce suite', accId: 'acc-infy', value: 8_400_000, stage: 'st-qual', close: '2026-06-28', owner: 'Arjun Trivedi' },
  { id: 'dl-4', code: 'DEAL-1004', name: 'Zomato — Analytics add-on', accId: 'acc-zom', value: 3_600_000, stage: 'st-lead', close: '2026-07-18', owner: 'Vikram Singh' },
  { id: 'dl-5', code: 'DEAL-1005', name: 'Flipkart Health+ — CRM seats', accId: 'acc-fkh', value: 5_200_000, stage: 'st-prop', close: '2026-06-30', owner: 'Meera Krishnan' },
  { id: 'dl-6', code: 'DEAL-1006', name: 'Swiggy Instamart — Inventory module', accId: 'acc-swg', value: 6_800_000, stage: 'st-nego', close: '2026-06-15', owner: 'Arjun Trivedi' },
  { id: 'dl-7', code: 'DEAL-1007', name: 'Tata Digital — Premium support', accId: 'acc-tata', value: 2_400_000, stage: 'st-won', close: '2026-05-10', owner: 'Vikram Singh' },
  { id: 'dl-8', code: 'DEAL-1008', name: 'Reliance Retail — Loyalty engine', accId: 'acc-ril', value: 15_600_000, stage: 'st-qual', close: '2026-08-01', owner: 'Meera Krishnan' },
  { id: 'dl-9', code: 'DEAL-1009', name: 'Zomato — Onboarding services', accId: 'acc-zom', value: 1_800_000, stage: 'st-won', close: '2026-05-02', owner: 'Vikram Singh' },
  { id: 'dl-10', code: 'DEAL-1010', name: 'Infosys BPM — Pilot expansion', accId: 'acc-infy', value: 9_900_000, stage: 'st-lead', close: '2026-08-12', owner: 'Arjun Trivedi' },
  { id: 'dl-11', code: 'DEAL-1011', name: 'Flipkart Health+ — Data migration', accId: 'acc-fkh', value: 4_100_000, stage: 'st-lead', close: '2026-07-25', owner: 'Meera Krishnan' },
  { id: 'dl-12', code: 'DEAL-1012', name: 'Swiggy Instamart — Renewal', accId: 'acc-swg', value: 7_300_000, stage: 'st-lost', close: '2026-05-08', owner: 'Arjun Trivedi' },
  { id: 'dl-13', code: 'DEAL-1013', name: 'Tata Digital — API gateway', accId: 'acc-tata', value: 11_200_000, stage: 'st-prop', close: '2026-07-10', owner: 'Vikram Singh' },
  { id: 'dl-14', code: 'DEAL-1014', name: 'Reliance Retail — Multi-region', accId: 'acc-ril', value: 19_400_000, stage: 'st-nego', close: '2026-06-22', owner: 'Meera Krishnan' }
];

export const SAMPLE_DEALS: Deal[] = DEAL_SEEDS.map((d) => {
  const stage = SAMPLE_STAGES.find((s) => s.id === d.stage)!;
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    accountId: d.accId,
    accountName: acc(d.accId),
    contactId: null,
    contactName: null,
    value: d.value,
    stageId: stage.id,
    stageName: stage.name,
    status: stage.isWon ? 'won' : stage.isLost ? 'lost' : 'open',
    probability: stage.probability,
    closeDate: d.close,
    owner: d.owner,
    lastActivityAt: null,
    createdAt: '2026-04-15T09:00:00Z'
  } satisfies Deal;
});

export const SAMPLE_ACTIVITIES: Activity[] = [
  { id: 'ac-1', type: 'call', subject: 'Discovery call — scope POS rollout', dueAt: '2026-05-29T10:30:00Z', status: 'open', relatedToType: 'deal', relatedToId: 'dl-2', owner: 'Meera Krishnan', createdAt: '2026-05-26T09:00:00Z' },
  { id: 'ac-2', type: 'meeting', subject: 'Solution demo with VP Engineering', dueAt: '2026-05-30T14:00:00Z', status: 'open', relatedToType: 'deal', relatedToId: 'dl-1', owner: 'Vikram Singh', createdAt: '2026-05-26T09:00:00Z' },
  { id: 'ac-3', type: 'email', subject: 'Send revised pricing proposal', dueAt: '2026-05-31T09:00:00Z', status: 'open', relatedToType: 'deal', relatedToId: 'dl-5', owner: 'Meera Krishnan', createdAt: '2026-05-27T09:00:00Z' },
  { id: 'ac-4', type: 'task', subject: 'Prepare security questionnaire', dueAt: '2026-06-02T09:00:00Z', status: 'open', relatedToType: 'deal', relatedToId: 'dl-3', owner: 'Arjun Trivedi', createdAt: '2026-05-27T09:00:00Z' },
  { id: 'ac-5', type: 'call', subject: 'Negotiation follow-up', dueAt: '2026-05-26T11:00:00Z', completedAt: '2026-05-26T11:30:00Z', status: 'done', relatedToType: 'deal', relatedToId: 'dl-6', owner: 'Arjun Trivedi', createdAt: '2026-05-25T09:00:00Z' },
  { id: 'ac-6', type: 'meeting', subject: 'Quarterly business review', dueAt: '2026-06-05T15:00:00Z', status: 'open', relatedToType: 'deal', relatedToId: 'dl-8', owner: 'Meera Krishnan', createdAt: '2026-05-27T09:00:00Z' },
  { id: 'ac-7', type: 'email', subject: 'Intro email — qualify budget', dueAt: '2026-05-29T09:00:00Z', status: 'open', relatedToType: 'lead', relatedToId: 'ld-1', owner: 'Vikram Singh', createdAt: '2026-05-27T09:00:00Z' },
  { id: 'ac-8', type: 'call', subject: 'Qualify timeline & authority', dueAt: '2026-05-30T16:00:00Z', status: 'open', relatedToType: 'lead', relatedToId: 'ld-4', owner: 'Vikram Singh', createdAt: '2026-05-27T09:00:00Z' }
];

export const SAMPLE_NOTES: Note[] = [
  { id: 'nt-1', body: 'Champion is the VP Engineering; economic buyer is the CFO. Budget approved for FY27.', relatedToType: 'deal', relatedToId: 'dl-1', author: 'Vikram Singh', createdAt: '2026-05-20T09:00:00Z' },
  { id: 'nt-2', body: 'Competing against an in-house build. Differentiator: time-to-value & SLAs.', relatedToType: 'deal', relatedToId: 'dl-2', author: 'Meera Krishnan', createdAt: '2026-05-21T09:00:00Z' },
  { id: 'nt-3', body: 'Security review scheduled. Needs SOC2 report + DPA.', relatedToType: 'deal', relatedToId: 'dl-3', author: 'Arjun Trivedi', createdAt: '2026-05-22T09:00:00Z' },
  { id: 'nt-4', body: 'Warm inbound from webinar. High intent — fast-track to demo.', relatedToType: 'lead', relatedToId: 'ld-1', author: 'Vikram Singh', createdAt: '2026-05-22T09:00:00Z' }
];
