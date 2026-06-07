export type ServiceType = 'Project' | 'FieldService' | 'Helpdesk' | 'Appointment';
export type ServiceStage = 'new' | 'scheduled' | 'inprogress' | 'review' | 'done' | 'cancelled';
export type ServicePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ServiceEvent { kind: string; from?: string; to?: string; note?: string; by?: string; at: string; }
export interface ServiceTimesheetEntry { id: string; person: string; date: string; hours: number; note?: string | null; }

export interface ServiceOrder {
  id: string;
  code: string;
  title: string;
  type: ServiceType;
  stage: ServiceStage;
  priority: ServicePriority;
  customer: string;
  assignedTo?: string | null;
  scheduledAt?: string | null;
  dueAt?: string | null;
  estimatedHours: number;
  loggedHours: number;
  progress: number;
  tags: string[];
  description?: string | null;
  createdAt: string;
  activity?: ServiceEvent[] | null;
  timesheets?: ServiceTimesheetEntry[] | null;
}

export interface ServiceSummary {
  totalOrders: number;
  open: number;
  overdue: number;
  done: number;
  loggedHours: number;
  funnel: { new: number; scheduled: number; inProgress: number; review: number; done: number; cancelled: number };
  byType: { type: string; total: number; open: number }[];
}

export interface TimesheetReport {
  entries: (ServiceTimesheetEntry & { orderId: string; code?: string; title: string; type?: string; customer?: string })[];
  byPerson: { person: string; hours: number; entries: number }[];
  totalHours: number;
}

export const SERVICE_TYPE_META: Record<ServiceType, { label: string; icon: string }> = {
  Project: { label: 'Project', icon: 'pi-folder' },
  FieldService: { label: 'Field Service', icon: 'pi-truck' },
  Helpdesk: { label: 'Helpdesk', icon: 'pi-comments' },
  Appointment: { label: 'Appointment', icon: 'pi-calendar-plus' }
};

export const SERVICE_STAGES: { key: ServiceStage; label: string; dot: string }[] = [
  { key: 'new', label: 'New', dot: 'bg-surface-400' },
  { key: 'scheduled', label: 'Scheduled', dot: 'bg-brand-400' },
  { key: 'inprogress', label: 'In Progress', dot: 'bg-indigo-400' },
  { key: 'review', label: 'Review', dot: 'bg-amber-400' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', dot: 'bg-rose-400' }
];
