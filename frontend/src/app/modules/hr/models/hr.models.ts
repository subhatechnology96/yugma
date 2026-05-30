export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
export type EmployeeStatus = 'active' | 'on-leave' | 'inactive';

export interface Employee {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  department: string;
  designation: string;
  manager?: string;
  location: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  joinedAt: string;
  ctcLakhs: number;
  performance: 1 | 2 | 3 | 4 | 5;
  skills: string[];
}

export interface LeaveRequest {
  id: string;
  employee: string;
  type: 'Casual' | 'Sick' | 'Earned' | 'Comp-off' | 'Unpaid';
  from: string;
  to: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
}

export interface AttendanceRow {
  employee: string;
  department: string;
  in: string;
  out: string;
  hours: number;
  status: 'present' | 'late' | 'absent' | 'wfh' | 'leave';
}

export interface PayrollRun {
  cycle: string;
  total: number;
  employees: number;
  status: 'draft' | 'approved' | 'paid' | 'processing';
  runAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  source: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  rating: 1 | 2 | 3 | 4 | 5;
  appliedAt: string;
}
