export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  badge?: string;
  badgeTone?: 'info' | 'success' | 'warn' | 'danger';
  children?: NavItem[];
  group?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { group: 'Overview', label: 'Dashboard', icon: 'pi-th-large', route: '/dashboard' },
  {
    group: 'Operations',
    label: 'HR',
    icon: 'pi-users',
    children: [
      { label: 'AI Agents Hub', icon: 'pi-sparkles', route: '/hr/agents', badge: 'GPT-5', badgeTone: 'info' },
      { label: 'Employees', icon: 'pi-id-card', route: '/hr/employees' },
      { label: 'Attendance', icon: 'pi-clock', route: '/hr/attendance' },
      { label: 'Leave', icon: 'pi-calendar', route: '/hr/leave' },
      { label: 'Payroll', icon: 'pi-money-bill', route: '/hr/payroll' },
      { label: 'Recruitment', icon: 'pi-user-plus', route: '/hr/recruitment' },
      { label: 'Performance', icon: 'pi-chart-line', route: '/hr/performance' },
      { label: 'Team Management', icon: 'pi-sitemap', route: '/hr/team' },
      { label: 'Hierarchy', icon: 'pi-share-alt', route: '/hr/hierarchy', badge: 'New', badgeTone: 'info' },
      { label: 'HR Analytics', icon: 'pi-chart-pie', route: '/hr/analytics' }
    ]
  },
  {
    group: 'Operations',
    label: 'CRM',
    icon: 'pi-briefcase',
    badge: 'New',
    badgeTone: 'info',
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
  { group: 'Operations', label: 'Workflows', icon: 'pi-sitemap', route: '/workflow' },
  { group: 'Insights', label: 'Reports & Analytics', icon: 'pi-chart-bar', route: '/reports' },
  { group: 'Insights', label: 'AI Assistant', icon: 'pi-sparkles', route: '/ai-assistant', badge: 'Beta', badgeTone: 'warn' },
  { group: 'Admin', label: 'Notifications', icon: 'pi-bell', route: '/notifications' },
  { group: 'Admin', label: 'User Management', icon: 'pi-id-card', route: '/users' },
  { group: 'Admin', label: 'IT Provisioning', icon: 'pi-server', route: '/it/provisioning', badge: 'New', badgeTone: 'warn' },
  { group: 'Admin', label: 'Configuration', icon: 'pi-cog', route: '/configuration' },
  { group: 'Admin', label: 'Audit Logs', icon: 'pi-shield', route: '/audit' },
  { group: 'Admin', label: 'Settings', icon: 'pi-sliders-h', route: '/settings' }
];
