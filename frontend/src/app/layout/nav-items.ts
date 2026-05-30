/**
 * Access tag controlling whether a nav item is shown:
 * - undefined  → any signed-in user
 * - 'teamLead' → HR/admins, or a team lead (has reports)
 * - 'hrManage' → HR-department members or admins/owners
 * - 'admin'    → admin / owner / super_admin roles
 */
export type NavAccess = 'teamLead' | 'hrManage' | 'admin';

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
}

export const NAV_ITEMS: NavItem[] = [
  { group: 'Overview', label: 'Dashboard', icon: 'pi-th-large', route: '/dashboard' },
  {
    group: 'Operations',
    label: 'HR',
    icon: 'pi-users',
    children: [
      { label: 'AI Agents Hub', icon: 'pi-sparkles', route: '/hr/agents', badge: 'GPT-5', badgeTone: 'info', requires: 'hrManage' },
      { label: 'Employees', icon: 'pi-id-card', route: '/hr/employees' },
      { label: 'Attendance', icon: 'pi-clock', route: '/hr/attendance' },
      { label: 'Leave', icon: 'pi-calendar', route: '/hr/leave' },
      { label: 'Payroll', icon: 'pi-money-bill', route: '/hr/payroll' },
      { label: 'Recruitment', icon: 'pi-user-plus', route: '/hr/recruitment', requires: 'hrManage' },
      { label: 'Performance', icon: 'pi-chart-line', route: '/hr/performance' },
      { label: 'Team Management', icon: 'pi-sitemap', route: '/hr/team', requires: 'teamLead' },
      { label: 'Hierarchy', icon: 'pi-share-alt', route: '/hr/hierarchy', requires: 'teamLead' },
      { label: 'HR Analytics', icon: 'pi-chart-pie', route: '/hr/analytics', requires: 'hrManage' }
    ]
  },
  {
    group: 'Operations',
    label: 'CRM',
    icon: 'pi-briefcase',
    requires: 'admin',
    children: [
      { label: 'Dashboard', icon: 'pi-th-large', route: '/crm/dashboard' },
      { label: 'Leads', icon: 'pi-filter', route: '/crm/leads' },
      { label: 'Contacts', icon: 'pi-id-card', route: '/crm/contacts' },
      { label: 'Accounts', icon: 'pi-building', route: '/crm/accounts' },
      { label: 'Deals / Pipeline', icon: 'pi-sitemap', route: '/crm/deals' },
      { label: 'Activities', icon: 'pi-calendar', route: '/crm/activities' },
      { label: 'Quotes', icon: 'pi-file-edit', route: '/crm/quotes' },
      { label: 'CRM Analytics', icon: 'pi-chart-pie', route: '/crm/analytics' }
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
