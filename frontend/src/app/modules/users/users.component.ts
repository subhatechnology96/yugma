import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { AuthService } from '@core/services/auth.service';
import { environment } from '@env/environment';

type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  mfa: boolean;
  lastLoginAt: string | null;
  invitedAt: string | null;
  createdAt: string;
  status: UserStatus;
}

interface UserStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  inactive: number;
  mfaEnabled: number;
  mfaCoverage: number;
}

interface RoleDef {
  key: string;
  label: string;
  description: string;
  tone: string;
  permissions: string[];
  members: number;
}

interface UserDraft {
  id?: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string;
  department: string;
  mfa: boolean;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    DatePipe, TitleCasePipe, FormsModule,
    TableModule, ButtonModule, DialogModule, SelectModule, InputTextModule, MenuModule, TooltipModule, ToggleSwitchModule,
    PageHeaderComponent, KpiCardComponent, StatusPillComponent, AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Admin" title="User management" subtitle="Roles, permissions, MFA enforcement and seat allocation.">
      <button pButton severity="secondary" [outlined]="true" icon="pi pi-key" label="Roles" (click)="openRoles()"></button>
      @if (canManage()) {
        <button pButton icon="pi pi-user-plus" label="Invite user" (click)="openInvite()"></button>
      }
    </app-page-header>

    <!-- KPI strip -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
      <app-kpi-card label="Total users" [value]="stats().total" icon="pi-users" tone="brand"
        caption="seats provisioned" [interactive]="true" [active]="statusFilter() === null" (cardClick)="setStatus(null)" />
      <app-kpi-card label="Active" [value]="stats().active" icon="pi-check-circle" tone="emerald"
        caption="signed-in & enabled" [interactive]="true" [active]="statusFilter() === 'active'" (cardClick)="setStatus('active')" />
      <app-kpi-card label="Pending invites" [value]="stats().pending" icon="pi-send" tone="amber"
        caption="awaiting acceptance" [interactive]="true" [active]="statusFilter() === 'pending'" (cardClick)="setStatus('pending')" />
      <app-kpi-card label="MFA coverage" [value]="stats().mfaCoverage" suffix="%" icon="pi-shield" tone="indigo"
        [caption]="stats().mfaEnabled + ' of ' + stats().total + ' protected'" />
    </div>

    <div class="card">
      <!-- toolbar -->
      <div class="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <span class="p-input-icon-left flex-1 max-w-sm">
          <i class="pi pi-search"></i>
          <input pInputText type="text" placeholder="Search name, email, title…"
            [ngModel]="search()" (ngModelChange)="onSearch($event)" class="w-full" />
        </span>
        <div class="flex items-center gap-2 flex-wrap">
          <p-select [options]="roleOptions" [ngModel]="roleFilter()" (ngModelChange)="setRole($event)"
            placeholder="All roles" [showClear]="true" styleClass="w-44" />
          <p-select [options]="statusOptions" [ngModel]="statusFilter()" (ngModelChange)="setStatus($event)"
            placeholder="All statuses" [showClear]="true" styleClass="w-44" />
          @if (search() || roleFilter() || statusFilter()) {
            <button pButton severity="secondary" [text]="true" icon="pi pi-filter-slash" label="Clear" (click)="clearFilters()"></button>
          }
          <span class="text-sm text-surface-500 ml-1">{{ users().length }} shown</span>
        </div>
      </div>

      <p-table [value]="users()" responsiveLayout="scroll" [rowHover]="true" [loading]="loading()"
        [paginator]="users().length > 12" [rows]="12" dataKey="id">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase">User</th>
            <th class="!text-xs !uppercase">Role</th>
            <th class="!text-xs !uppercase">Title / Department</th>
            <th class="!text-xs !uppercase">MFA</th>
            <th class="!text-xs !uppercase">Last login</th>
            <th class="!text-xs !uppercase">Status</th>
            <th class="!text-xs !uppercase !text-right">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-u>
          <tr>
            <td>
              <div class="flex items-center gap-3">
                <app-avatar [name]="u.name" size="sm" />
                <div>
                  <div class="font-medium">{{ u.name }}</div>
                  <div class="text-xs text-surface-500">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td><app-status-pill [tone]="roleTone(u.role)">{{ u.role }}</app-status-pill></td>
            <td>
              <div class="text-sm">{{ u.jobTitle || '—' }}</div>
              <div class="text-xs text-surface-500">{{ u.department || '' }}</div>
            </td>
            <td>
              <button type="button" class="inline-flex" (click)="canManage() && toggleMfa(u)"
                [pTooltip]="canManage() ? (u.mfa ? 'Click to disable MFA' : 'Click to enable MFA') : ''" tooltipPosition="top"
                [class.cursor-pointer]="canManage()" [class.cursor-default]="!canManage()">
                <app-status-pill [tone]="u.mfa ? 'success' : 'warn'">{{ u.mfa ? 'Enabled' : 'Disabled' }}</app-status-pill>
              </button>
            </td>
            <td class="text-sm text-surface-500">
              @if (u.status === 'pending') {
                <span class="text-amber-600 dark:text-amber-400 text-xs">Invited {{ (u.invitedAt | date: 'mediumDate') || '—' }}</span>
              } @else {
                {{ (u.lastLoginAt | date: 'short') || 'Never' }}
              }
            </td>
            <td><app-status-pill [tone]="statusTone(u.status)">{{ u.status | titlecase }}</app-status-pill></td>
            <td class="text-right">
              @if (canManage()) {
                <button pButton [text]="true" rounded icon="pi pi-ellipsis-v" class="!text-surface-500"
                  (click)="rowMenuRef.toggle($event); activeRow.set(u)"></button>
                <p-menu #rowMenuRef [model]="rowMenu()" [popup]="true" styleClass="!rounded-xl" appendTo="body" />
              } @else {
                <span class="text-xs text-surface-400">—</span>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="text-center py-10 text-surface-500">
            <i class="pi pi-users text-2xl mb-2 block"></i>No users match the current filters.
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Invite / Edit dialog -->
    <p-dialog [(visible)]="formOpen" [modal]="true" [style]="{ width: '32rem' }" [draggable]="false"
      [header]="draft().id ? 'Edit user' : 'Invite user'">
      <div class="flex flex-col gap-4 pt-1">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Full name</label>
            <input pInputText [(ngModel)]="draft().name" placeholder="Jane Cooper" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Email</label>
            <input pInputText [(ngModel)]="draft().email" placeholder="jane@company.com" [disabled]="!!draft().id" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Role</label>
            <p-select [options]="assignableRoleOptions" [(ngModel)]="draft().role" placeholder="Select role" appendTo="body" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Department</label>
            <input pInputText [(ngModel)]="draft().department" placeholder="Engineering" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Job title</label>
          <input pInputText [(ngModel)]="draft().jobTitle" placeholder="Senior Software Engineer" />
        </div>
        @if (!draft().id) {
          <div class="flex items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3">
            <div>
              <div class="text-sm font-medium">Require multi-factor authentication</div>
              <div class="text-xs text-surface-500">Recommended for all admin & manager roles.</div>
            </div>
            <p-toggleswitch [(ngModel)]="draft().mfa" />
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" [text]="true" label="Cancel" (click)="formOpen.set(false)"></button>
        <button pButton [label]="draft().id ? 'Save changes' : 'Send invite'" [icon]="draft().id ? 'pi pi-check' : 'pi pi-send'"
          [disabled]="!draftValid()" (click)="submit()"></button>
      </ng-template>
    </p-dialog>

    <!-- Roles & permissions dialog -->
    <p-dialog [(visible)]="rolesOpen" [modal]="true" [style]="{ width: '46rem' }" [draggable]="false" header="Roles & permissions">
      <p class="text-sm text-surface-500 mb-4">Four built-in roles govern what each seat can see and do. Member counts reflect the current workspace.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        @for (r of roles(); track r.key) {
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 flex flex-col gap-3">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold">{{ r.label }}</div>
                <div class="text-xs text-surface-500 mt-0.5">{{ r.description }}</div>
              </div>
              <app-status-pill [tone]="roleTone(r.key)">{{ r.members }} {{ r.members === 1 ? 'user' : 'users' }}</app-status-pill>
            </div>
            <ul class="flex flex-col gap-1.5">
              @for (p of r.permissions; track p) {
                <li class="text-xs flex items-center gap-2 text-surface-600 dark:text-surface-300">
                  <i class="pi pi-check text-emerald-500 text-[10px]"></i>{{ p }}
                </li>
              }
            </ul>
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" label="Close" (click)="rolesOpen.set(false)"></button>
      </ng-template>
    </p-dialog>
  `
})
export class UsersComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly base = `${environment.apiBaseUrl}/users`;

  protected readonly users = signal<UserRow[]>([]);
  protected readonly stats = signal<UserStats>({ total: 0, active: 0, pending: 0, suspended: 0, inactive: 0, mfaEnabled: 0, mfaCoverage: 0 });
  protected readonly roles = signal<RoleDef[]>([]);
  protected readonly loading = signal(false);

  protected readonly search = signal('');
  protected readonly roleFilter = signal<string | null>(null);
  protected readonly statusFilter = signal<UserStatus | null>(null);

  protected readonly activeRow = signal<UserRow | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly rolesOpen = signal(false);
  protected readonly draft = signal<UserDraft>(this.blankDraft());

  protected readonly roleOptions = [
    { label: 'Owner', value: 'Owner' }, { label: 'Admin', value: 'Admin' },
    { label: 'Manager', value: 'Manager' }, { label: 'Member', value: 'Member' }
  ];
  // Owner is intentionally not assignable from the invite/edit form (transfer-ownership is a separate flow).
  protected readonly assignableRoleOptions = this.roleOptions.filter((o) => o.value !== 'Owner');
  protected readonly statusOptions = [
    { label: 'Active', value: 'active' }, { label: 'Pending', value: 'pending' },
    { label: 'Suspended', value: 'suspended' }, { label: 'Inactive', value: 'inactive' }
  ];

  protected readonly canManage = computed(() => {
    const roles = (this.auth.user()?.roles ?? []).map((r) => r.toLowerCase());
    return roles.some((r) => ['admin', 'owner', 'hr', 'super_admin'].includes(r));
  });

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    this.loadStats();
    this.loadRoles();
  }

  // ---------------- data ----------------
  private load(): void {
    this.loading.set(true);
    let params = new HttpParams();
    if (this.search().trim()) params = params.set('q', this.search().trim());
    if (this.roleFilter()) params = params.set('role', this.roleFilter()!);
    if (this.statusFilter()) params = params.set('status', this.statusFilter()!);
    this.http.get<UserRow[]>(this.base, { params }).subscribe({
      next: (r) => { this.users.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
  private loadStats(): void {
    this.http.get<UserStats>(`${this.base}/stats`).subscribe((s) => this.stats.set(s));
  }
  private loadRoles(): void {
    this.http.get<RoleDef[]>(`${this.base}/roles`).subscribe((r) => this.roles.set(r));
  }
  private refresh(): void { this.load(); this.loadStats(); this.loadRoles(); }

  // ---------------- filters ----------------
  onSearch(v: string): void {
    this.search.set(v);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(), 250);
  }
  setRole(v: string | null): void { this.roleFilter.set(v); this.load(); }
  setStatus(v: UserStatus | null): void { this.statusFilter.set(v); this.load(); }
  clearFilters(): void { this.search.set(''); this.roleFilter.set(null); this.statusFilter.set(null); this.load(); }

  // ---------------- row menu ----------------
  rowMenu(): MenuItem[] {
    const u = this.activeRow();
    if (!u) return [];
    const items: MenuItem[] = [
      { label: 'Edit user', icon: 'pi pi-pencil', command: () => this.openEdit(u) },
      { label: u.mfa ? 'Disable MFA' : 'Enable MFA', icon: 'pi pi-shield', command: () => this.toggleMfa(u) }
    ];
    if (u.status === 'pending') {
      items.push({ label: 'Resend invite', icon: 'pi pi-send', command: () => this.resendInvite(u) });
      items.push({ label: 'Activate now', icon: 'pi pi-check-circle', command: () => this.changeStatus(u, 'active') });
    } else if (u.status === 'active') {
      items.push({ label: 'Suspend', icon: 'pi pi-ban', command: () => this.changeStatus(u, 'suspended') });
      items.push({ label: 'Deactivate', icon: 'pi pi-power-off', command: () => this.changeStatus(u, 'inactive') });
    } else {
      items.push({ label: 'Reactivate', icon: 'pi pi-check-circle', command: () => this.changeStatus(u, 'active') });
    }
    items.push({ separator: true });
    items.push({
      label: 'Remove', icon: 'pi pi-trash', styleClass: 'text-rose-600',
      disabled: u.role === 'Owner',
      command: () => this.remove(u)
    });
    return items;
  }

  // ---------------- dialogs ----------------
  openInvite(): void { this.draft.set(this.blankDraft()); this.formOpen.set(true); }
  openEdit(u: UserRow): void {
    this.draft.set({ id: u.id, name: u.name, email: u.email, role: u.role, jobTitle: u.jobTitle ?? '', department: u.department ?? '', mfa: u.mfa });
    this.formOpen.set(true);
  }
  openRoles(): void { this.rolesOpen.set(true); }

  draftValid(): boolean {
    const d = this.draft();
    return d.name.trim().length > 1 && /.+@.+\..+/.test(d.email) && !!d.role;
  }

  submit(): void {
    const d = this.draft();
    const actedBy = this.actor();
    if (d.id) {
      this.http.put<UserRow>(`${this.base}/${d.id}`, {
        name: d.name, role: d.role, jobTitle: d.jobTitle || null, department: d.department || null, actedBy
      }).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: 'Saved', detail: `${d.name} updated.` }); this.formOpen.set(false); this.refresh(); },
        error: (e) => this.fail(e)
      });
    } else {
      this.http.post<UserRow>(this.base, {
        name: d.name, email: d.email, role: d.role, jobTitle: d.jobTitle || null, department: d.department || null, mfa: d.mfa, actedBy
      }).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: 'Invitation sent', detail: `${d.name} invited as ${d.role}.` }); this.formOpen.set(false); this.refresh(); },
        error: (e) => this.fail(e)
      });
    }
  }

  // ---------------- actions ----------------
  toggleMfa(u: UserRow): void {
    if (!this.canManage()) return;
    this.http.post<UserRow>(`${this.base}/${u.id}/mfa`, { enabled: !u.mfa, actedBy: this.actor() }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'MFA updated', detail: `MFA ${!u.mfa ? 'enabled' : 'disabled'} for ${u.name}.` }); this.refresh(); },
      error: (e) => this.fail(e)
    });
  }
  changeStatus(u: UserRow, status: UserStatus): void {
    this.http.post<UserRow>(`${this.base}/${u.id}/status`, { status, actedBy: this.actor() }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Status updated', detail: `${u.name} is now ${status}.` }); this.refresh(); },
      error: (e) => this.fail(e)
    });
  }
  resendInvite(u: UserRow): void {
    this.http.post<UserRow>(`${this.base}/${u.id}/resend-invite`, { actedBy: this.actor() }).subscribe({
      next: () => this.toast.add({ severity: 'success', summary: 'Invite re-sent', detail: `Invitation re-sent to ${u.email}.` }),
      error: (e) => this.fail(e)
    });
  }
  remove(u: UserRow): void {
    this.confirm.confirm({
      header: 'Remove user',
      message: `Remove ${u.name} (${u.email}) from the workspace? This frees up their seat and cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove', rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const params = new HttpParams().set('actedBy', this.actor());
        this.http.delete(`${this.base}/${u.id}`, { params }).subscribe({
          next: () => { this.toast.add({ severity: 'success', summary: 'Removed', detail: `${u.name} removed.` }); this.refresh(); },
          error: (e) => this.fail(e)
        });
      }
    });
  }

  // ---------------- helpers ----------------
  roleTone(role: string): StatusTone {
    switch (role) {
      case 'Owner': return 'info';
      case 'Admin': return 'danger';
      case 'Manager': return 'warn';
      default: return 'neutral';
    }
  }
  statusTone(status: UserStatus): StatusTone {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warn';
      case 'suspended': return 'danger';
      default: return 'neutral';
    }
  }

  private actor(): string { return this.auth.user()?.fullName ?? this.auth.user()?.email ?? 'system'; }
  private fail(e: unknown): void {
    const detail = (e as { error?: { error?: string } })?.error?.error ?? 'Something went wrong. Please try again.';
    this.toast.add({ severity: 'error', summary: 'Action failed', detail });
  }
  private blankDraft(): UserDraft { return { name: '', email: '', role: 'Member', jobTitle: '', department: '', mfa: true }; }
}
