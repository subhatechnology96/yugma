/**
 * Access tag controlling whether a nav item is shown:
 * - undefined    → any signed-in user
 * - 'hasReports' → strictly someone with direct/indirect reports (a real manager) — NOT HR/admins without a team
 * - 'teamLead'   → HR/admins, or a team lead (has reports)
 * - 'hrManage'   → HR-department members or admins/owners (the "HR Work" area)
 * - 'admin'      → admin / owner / super_admin roles
 * - 'services'   → Services-department members (the "services" role) or admins/owners
 * - 'finance'    → Finance-department members (the "finance" role) or admins/owners
 */
export type NavAccess = 'hasReports' | 'teamLead' | 'hrManage' | 'admin' | 'services' | 'finance';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  badge?: string;
  badgeTone?: 'info' | 'success' | 'warn' | 'danger';
  children?: NavItem[];
  group?: string;
  requires?: NavAccess;
  /** Use exact route matching for the active highlight (e.g. a list route that is a prefix of a detail route). */
  exact?: boolean;
  /** Resolved at render time to a user-relative link (e.g. 'profile' → the signed-in user's own record). */
  dynamic?: 'profile';
}

export const NAV_ITEMS: NavItem[] = [
  { group: 'Overview', label: 'Dashboard', icon: 'pi-th-large', route: '/dashboard' },
  {
    // Personal employee self-service — every signed-in user sees this.
    group: 'Operations',
    label: 'My Work',
    icon: 'pi-user',
    children: [
      { label: 'Profile', icon: 'pi-id-card', dynamic: 'profile' },
      { label: 'Attendance', icon: 'pi-clock', route: '/my-work/attendance' },
      { label: 'Leave', icon: 'pi-calendar', route: '/my-work/leave' },
      { label: 'My Requests', icon: 'pi-inbox', route: '/my-requests' },
      { label: 'Payroll', icon: 'pi-money-bill', route: '/my-work/payroll' },
      { label: 'My Performance', icon: 'pi-chart-line', route: '/my-work/performance' },
      { label: 'Hierarchy', icon: 'pi-share-alt', route: '/my-work/hierarchy' }
    ]
  },
  {
    // Human Resources — visible to HR staff and admins/owners (hrManage).
    group: 'Human Resources',
    label: 'Human Resources',
    icon: 'pi-briefcase',
    requires: 'hrManage',
    children: [
      { label: 'Employees', icon: 'pi-id-card', route: '/my-work/employees', exact: true },
      { label: 'Recruitment', icon: 'pi-user-plus', route: '/my-work/recruitment' },
      { label: 'Time Off', icon: 'pi-calendar-times', route: '/my-work/time-off' },
      { label: 'Attendances', icon: 'pi-clock', route: '/my-work/attendance' },
      { label: 'Appraisals', icon: 'pi-star', route: '/my-work/appraisals' },
      { label: 'Payroll', icon: 'pi-money-bill', route: '/my-work/payroll-runs' },
      { label: 'Referrals', icon: 'pi-share-alt', route: '/my-work/referrals' },
      { label: 'Fleet', icon: 'pi-car', route: '/my-work/fleet' },
      { label: 'AI Agents Hub', icon: 'pi-sparkles', route: '/my-work/agents', badge: 'GPT-5', badgeTone: 'info' },
      { label: 'HR Analytics', icon: 'pi-chart-pie', route: '/my-work/analytics' }
    ]
  },
  {
    // Manager view — only people who actually have reports (NOT HR/admins without a team).
    group: 'Operations',
    label: 'My Team',
    icon: 'pi-users',
    requires: 'hasReports',
    children: [
      { label: 'Employee', icon: 'pi-id-card', route: '/my-team/employees' },
      { label: 'Approvals', icon: 'pi-check-square', route: '/my-team/approvals' },
      { label: 'Performance', icon: 'pi-chart-line', route: '/my-team/performance' }
    ]
  },
  {
    // Services delivery — Services-department staff and admins/owners (the "services" role).
    group: 'Services',
    label: 'Services',
    icon: 'pi-wrench',
    requires: 'services',
    children: [
      { label: 'Dashboard', icon: 'pi-th-large', route: '/services/dashboard' },
      { label: 'Pipeline', icon: 'pi-sitemap', route: '/services/pipeline', exact: true },
      { label: 'Project', icon: 'pi-folder', route: '/services/project' },
      { label: 'Field Service', icon: 'pi-truck', route: '/services/field-service' },
      { label: 'Helpdesk', icon: 'pi-comments', route: '/services/helpdesk' },
      { label: 'Appointments', icon: 'pi-calendar-plus', route: '/services/appointments' },
      { label: 'Timesheets', icon: 'pi-clock', route: '/services/timesheets' },
      { label: 'Planning', icon: 'pi-calendar', route: '/services/planning' }
    ]
  },
  {
    // Finance — Finance-department staff and admins/owners (the "finance" role).
    group: 'Finance',
    label: 'Finance',
    icon: 'pi-wallet',
    requires: 'finance',
    children: [
      { label: 'Accounting', icon: 'pi-th-large', route: '/finance/accounting' },
      { label: 'Invoicing', icon: 'pi-file', route: '/finance/invoicing' },
      { label: 'Expenses', icon: 'pi-credit-card', route: '/finance/expenses' },
      { label: 'Spreadsheet (BI)', icon: 'pi-chart-bar', route: '/finance/spreadsheet' },
      { label: 'Documents', icon: 'pi-folder-open', route: '/finance/documents' },
      { label: 'Sign', icon: 'pi-pencil', route: '/finance/sign' }
    ]
  },
  { group: 'Operations', label: 'Workflows', icon: 'pi-sitemap', route: '/workflow', requires: 'admin' },
  { group: 'Insights', label: 'Reports & Analytics', icon: 'pi-chart-bar', route: '/reports', requires: 'hrManage' },
  { group: 'Insights', label: 'AI Assistant', icon: 'pi-sparkles', route: '/ai-assistant', badge: 'Beta', badgeTone: 'warn' },
  // Admin group — only admins/owners; the whole section hides for everyone else.
  { group: 'Admin', label: 'User Management', icon: 'pi-id-card', route: '/users', requires: 'admin' },
  { group: 'Admin', label: 'IT Provisioning', icon: 'pi-server', route: '/it/provisioning', badge: 'New', badgeTone: 'warn', requires: 'admin' },
  { group: 'Admin', label: 'Configuration', icon: 'pi-cog', route: '/configuration', requires: 'admin' },
  { group: 'Admin', label: 'Audit Logs', icon: 'pi-shield', route: '/audit', requires: 'admin' },
  // Account group — personal items everyone has.
  { group: 'Account', label: 'Notifications', icon: 'pi-bell', route: '/notifications' },
  { group: 'Account', label: 'Settings', icon: 'pi-sliders-h', route: '/settings' }
];
