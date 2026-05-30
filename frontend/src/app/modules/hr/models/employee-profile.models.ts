// Read-models for the rich employee profile tabs (overview/attendance/leave/payroll/documents).

export interface TimelineEntry {
  date: string;
  title: string;
  detail: string;
  icon: string;
}

export interface EmployeeOverview {
  department: string;
  designation: string;
  employmentType: string;
  manager: string;
  location: string;
  worksite: string;
  grade: string;
  joinedAt: string;
  probationEndsAt: string;
  nextReviewAt: string;
  tenureYears: number;
  performance: number;
  attendanceRatePct: number;
  leaveAvailableDays: number;
  lastNetPay: number;
  workEmail: string;
  personalEmail: string;
  phone: string;
  dateOfBirth: string;
  bloodGroup: string;
  maritalStatus: string;
  address: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  panMasked: string;
  aadhaarMasked: string;
  bankName: string;
  bankAccountMasked: string;
  uan: string;
  about: string;
  skills: string[];
  timeline: TimelineEntry[];
}

export type AttendanceDayStatus = 'Present' | 'Late' | 'Wfh' | 'Leave' | 'Absent';

export interface AttendanceDay {
  date: string;
  day: string;
  status: AttendanceDayStatus;
  inTime: string | null;
  outTime: string | null;
  hours: number;
}

export interface AttendanceOverview {
  workingDays: number;
  present: number;
  late: number;
  wfh: number;
  onLeave: number;
  absent: number;
  attendanceRatePct: number;
  punctualityPct: number;
  avgHours: number;
  totalHours: number;
  records: AttendanceDay[];
}

export interface LeaveBalance {
  type: string;
  entitled: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveItem {
  from: string;
  to: string;
  days: number;
  type: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  reason: string;
  appliedOn: string;
  approver: string;
}

export interface LeaveOverview {
  totalEntitled: number;
  totalUsed: number;
  totalAvailable: number;
  balances: LeaveBalance[];
  history: LeaveItem[];
}

export interface Payslip {
  period: string;
  payDate: string;
  status: string;
  paidDays: number;
  basic: number;
  hra: number;
  specialAllowance: number;
  conveyance: number;
  bonus: number;
  grossEarnings: number;
  providentFund: number;
  professionalTax: number;
  incomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollOverview {
  ctcAnnual: number;
  monthlyGross: number;
  monthlyNet: number;
  ytdGross: number;
  ytdNet: number;
  ytdTax: number;
  currency: string;
  latest: Payslip;
  payslips: Payslip[];
}

export interface EmployeeDocument {
  id: string;
  name: string;
  category: string;
  fileType: string;
  sizeBytes: number;
  status: 'Verified' | 'Pending' | 'Expired';
  uploadedAt: string;
  expiresAt: string | null;
  uploadedBy: string | null;
}

// ---------- Career / professional history ----------
export interface CareerSummary {
  name: string; currentRole: string; department: string; avatarUrl?: string;
  joinedAt: string; tenureYears: number; totalProjects: number; completedProjects: number;
  ongoingProjects: number; promotions: number; awards: number; avgProjectRating: number; coreSkills: string[];
}
export interface RoleStint { title: string; level: string; from: string; to: string | null; manager: string; years: number; }
export interface ManagerStint { name: string; relationship: string; from: string; to: string | null; }
export interface Achievement { date: string; title: string; description: string; category: string; }
export interface CareerEvent { date: string; type: string; title: string; detail: string; icon: string; }
export interface CareerProject {
  id: string; isCustom: boolean; name: string; domain: string; role: string; manager: string;
  startDate: string; endDate: string | null; status: string; rating: number; durationMonths: number; teamSize: number;
  responsibilities: string[]; outcome: string; feedback: string; skills: string[]; achievements: string[];
}
export interface Career {
  summary: CareerSummary;
  roleHistory: RoleStint[];
  managers: ManagerStint[];
  achievements: Achievement[];
  timeline: CareerEvent[];
  projects: CareerProject[];
}
