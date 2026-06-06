import { ApprovalStep } from '@shared/components/approval-flow/approval-flow.component';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Discriminator for the kind of request. Others plug in here. */
export type RequestCategory = 'leave' | 'attendance';

/**
 * A normalized, type-agnostic view of one of the current user's requests, with the
 * approval flow already resolved. Each source (leave, expense, provisioning, …) maps
 * its own row into this shape so the My Requests screen renders them uniformly.
 */
export interface MyRequest {
  id: string;
  category: RequestCategory;
  /** Human label for the kind, e.g. "Casual Leave". */
  typeLabel: string;
  /** PrimeIcon for the kind, e.g. "pi-calendar". */
  icon: string;
  title: string;
  subtitle: string;
  status: RequestStatus;
  /** ISO date the request was submitted. */
  submittedOn: string;
  summary: string;
  /** Resolved approval timeline (submitted → approver → escalation line). */
  steps: ApprovalStep[];
  /** Name of the person the request is currently awaiting, when pending. */
  pendingWith: string | null;
}

/** A node in the requester's reporting trail (`GET /api/hr/hierarchy/employee/{id}/trail`). */
export interface TrailNode {
  employeeId: string;
  name: string;
  code: string | null;
  band: number | null;
  levelCode: string | null;
  levelTitle: string | null;
  designation: string | null;
  department: string | null;
  avatarUrl: string | null;
  isYou: boolean;
}

/** Attendance time-correction request as returned by `GET /api/hr/attendance/corrections`. */
export interface CorrectionRow {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  requestedStatus: string;
  requestedInTime: string | null;
  requestedOutTime: string | null;
  reason: string;
  status: RequestStatus;
  approver: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

/** Leave row as returned by `GET /api/hr/leave`. */
export interface LeaveRow {
  id: string;
  employeeId: string | null;
  employee: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: RequestStatus;
  reason: string;
  appliedOn: string;
  approver: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}
