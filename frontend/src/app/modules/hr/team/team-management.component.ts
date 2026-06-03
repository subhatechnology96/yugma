import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { TreeModule } from 'primeng/tree';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, TreeNode } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { AuthService } from '@core/services/auth.service';
import { HrAccessService } from '@core/services/hr-access.service';
import { environment } from '@env/environment';

interface TeamRow {
  id: string; name: string; code: string; email: string; designation: string;
  department: string; manager?: string; team?: string; avatarUrl?: string; location: string;
}
interface HierNode {
  employeeId: string | null; name: string; code: string; designation: string;
  department: string; isEmployee: boolean; children: HierNode[];
}
interface HistoryRow {
  manager?: string; department?: string; team?: string; from: string; to: string | null;
  reason: string; changedBy: string; scheduled: boolean;
}

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [
    DatePipe, FormsModule, TableModule, TreeModule, ButtonModule, DialogModule, SelectModule,
    InputTextModule, TooltipModule, PageHeaderComponent, StatusPillComponent, AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Organization" title="Team Management" subtitle="Search, view the reporting hierarchy and assign or change managers, teams and departments — with effective dates and full audit trail.">
      @if (canManage()) {
        <button pButton severity="secondary" outlined icon="pi pi-sitemap" label="Reassign selected" [disabled]="!selectedRows().length" (click)="openReassign(selectedRows())"></button>
      }
    </app-page-header>

    @if (!canManage()) {
      <div class="card px-4 py-2.5 mb-4 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
        <i class="pi pi-info-circle mr-1"></i>You have view-only access. Assigning/changing hierarchy requires Admin, HR or Manager.
      </div>
    }

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <!-- Org structure -->
      <div class="card p-4 xl:col-span-1 self-start">
        <div class="section-title mb-3">Reporting hierarchy</div>
        <p-tree [value]="tree()" selectionMode="single" (onNodeSelect)="onTreeSelect($event)" styleClass="!border-0 !p-0 text-sm" />
      </div>

      <!-- Employees -->
      <div class="card xl:col-span-2 overflow-hidden">
        <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-3">
          <span class="relative flex-1 min-w-[14rem]">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
            <input pInputText [(ngModel)]="search" (input)="onSearch()" placeholder="Search name, ID, email, department, team…" class="w-full !pl-10 !rounded-lg" />
          </span>
          <p-select [options]="deptOptions()" [(ngModel)]="deptFilter" (onChange)="load()" placeholder="All departments" styleClass="!rounded-lg" />
          <span class="ml-auto text-xs text-surface-500">{{ rows().length }} employees · {{ selectedRows().length }} selected</span>
        </div>

        <p-table [value]="rows()" [(selection)]="selectionModel" dataKey="id" responsiveLayout="scroll" [rowHover]="true"
                 [paginator]="rows().length > 12" [rows]="12" (selectionChange)="selectedRows.set($event)">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              @if (canManage()) { <th class="!w-10"><p-tableHeaderCheckbox /></th> }
              <th class="!text-xs !uppercase !text-surface-500">Employee</th>
              <th class="!text-xs !uppercase !text-surface-500">Department</th>
              <th class="!text-xs !uppercase !text-surface-500">Manager</th>
              <th class="!text-xs !uppercase !text-surface-500">Team</th>
              <th class="!w-20"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-r>
            <tr>
              @if (canManage()) { <td><p-tableCheckbox [value]="r" /></td> }
              <td>
                <button type="button" class="flex items-center gap-3 text-left group" (click)="openDrawer(r)">
                  <app-avatar [name]="r.name" [image]="r.avatarUrl" size="sm" />
                  <div class="min-w-0">
                    <div class="font-medium truncate group-hover:text-brand-600">{{ r.name }}</div>
                    <div class="text-[11px] text-surface-500">{{ r.code }} · {{ r.designation }}</div>
                  </div>
                </button>
              </td>
              <td class="text-sm">{{ r.department }}</td>
              <td class="text-sm">{{ r.manager ?? '—' }}</td>
              <td class="text-sm text-surface-500">{{ r.team ?? '—' }}</td>
              <td>
                <div class="flex justify-end gap-1">
                  <button pButton text rounded size="small" icon="pi pi-history" pTooltip="History" class="!text-surface-500" (click)="openDrawer(r)"></button>
                  @if (canManage()) {
                    <button pButton text rounded size="small" icon="pi pi-pencil" pTooltip="Reassign" class="!text-surface-500" (click)="openReassign([r])"></button>
                  }
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage"><tr><td colspan="6" class="py-10 text-center text-surface-500">No employees match.</td></tr></ng-template>
        </p-table>
      </div>
    </div>

    <!-- Employee drawer (current + history) -->
    <p-dialog [(visible)]="drawerVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="drawerEmp()?.name || ''" [draggable]="false" [dismissableMask]="true">
      @if (drawerEmp(); as e) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center gap-3">
            <app-avatar [name]="e.name" [image]="e.avatarUrl" size="lg" />
            <div><div class="font-semibold">{{ e.name }}</div><div class="text-xs text-surface-500">{{ e.code }} · {{ e.designation }}</div></div>
            @if (canManage()) {
              <button pButton size="small" icon="pi pi-pencil" label="Reassign" class="ml-auto" (click)="openReassign([e])"></button>
            }
          </div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt class="text-[11px] uppercase text-surface-400">Manager</dt><dd class="font-medium">{{ e.manager ?? '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Department</dt><dd class="font-medium">{{ e.department }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Team</dt><dd class="font-medium">{{ e.team ?? '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Location</dt><dd class="font-medium">{{ e.location }}</dd></div>
          </dl>

          <div>
            <div class="section-title mb-2">Reporting history</div>
            @if (history(); as hist) {
              <ol class="relative border-l border-surface-200 dark:border-surface-800 ml-2 space-y-3">
                @for (h of hist; track h.from + (h.reason || '')) {
                  <li class="ml-4">
                    <span class="absolute -left-[7px] w-3 h-3 rounded-full" [class]="h.to ? 'bg-surface-300 dark:bg-surface-600' : (h.scheduled ? 'bg-amber-400' : 'bg-brand-500')"></span>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">{{ h.manager ?? '—' }}</span>
                      @if (h.team) { <span class="text-[11px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">{{ h.team }}</span> }
                      @if (h.scheduled) { <app-status-pill tone="warn">Scheduled</app-status-pill> }
                    </div>
                    <div class="text-[11px] text-surface-500">
                      {{ h.from | date: 'mediumDate' }} – {{ h.to ? (h.to | date: 'mediumDate') : 'Present' }} · {{ h.department }}
                      @if (h.reason) { <span> · {{ h.reason }}</span> }
                      @if (h.changedBy) { <span class="text-surface-400"> · by {{ h.changedBy }}</span> }
                    </div>
                  </li>
                }
              </ol>
            } @else {
              <div class="py-4 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner"></i></div>
            }
          </div>
        </div>
      }
      <ng-template pTemplate="footer"><button pButton label="Close" (click)="drawerVisible = false"></button></ng-template>
    </p-dialog>

    <!-- Reassign dialog -->
    <p-dialog [(visible)]="reassignVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="'Reassign · ' + targetLabel()" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-3 pt-1">
        <p class="text-xs text-surface-500">Leave a field blank to keep it unchanged. Changes apply on the effective date.</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-surface-600">New manager</label>
            <p-select [options]="managerOptions()" [(ngModel)]="form.manager" [editable]="true" [filter]="true" [showClear]="true" placeholder="Keep current" styleClass="w-full mt-1 !rounded-lg" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Department</label>
            <p-select [options]="deptValueOptions()" [(ngModel)]="form.department" [editable]="true" [showClear]="true" placeholder="Keep current" styleClass="w-full mt-1 !rounded-lg" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Team</label>
            <input pInputText [(ngModel)]="form.team" class="w-full mt-1 !rounded-lg" placeholder="Keep current" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Effective from</label>
            <input type="date" [(ngModel)]="form.effectiveFrom" class="w-full mt-1 p-inputtext !rounded-lg" />
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-surface-600">Reason</label>
            <input pInputText [(ngModel)]="form.reason" class="w-full mt-1 !rounded-lg" placeholder="e.g. Team restructure, transfer…" />
          </div>
        </div>

        @if (warnings().length) {
          <div class="rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
            @for (w of warnings(); track w.name) { <div><i class="pi pi-exclamation-triangle mr-1"></i>{{ w.name }}: {{ w.warning }}</div> }
          </div>
        }
        @if (isFuture()) {
          <div class="text-[11px] text-amber-600"><i class="pi pi-clock mr-1"></i>Future-dated — recorded as a scheduled change.</div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Preview" icon="pi pi-eye" (click)="preview()"></button>
        <button pButton severity="secondary" outlined label="Cancel" (click)="reassignVisible = false"></button>
        <button pButton label="Apply" icon="pi pi-check" [disabled]="warnings().length > 0" (click)="submit()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class TeamManagementComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiBaseUrl}/hr/team`;

  private readonly hrAccess = inject(HrAccessService);
  protected readonly canManage = computed(() => this.hrAccess.canManage());

  protected readonly rows = signal<TeamRow[]>([]);
  protected readonly tree = signal<TreeNode[]>([]);
  protected readonly managerOptions = signal<string[]>([]);
  protected readonly deptOptions = signal<{ label: string; value: string | null }[]>([{ label: 'All departments', value: null }]);
  protected readonly deptValueOptions = signal<string[]>([]);
  protected readonly selectedRows = signal<TeamRow[]>([]);
  protected selectionModel: TeamRow[] = [];

  protected search = '';
  protected deptFilter: string | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;

  // drawer
  drawerVisible = false;
  protected readonly drawerEmp = signal<TeamRow | null>(null);
  protected readonly history = signal<HistoryRow[] | null>(null);

  // reassign
  reassignVisible = false;
  protected readonly targetIds = signal<string[]>([]);
  protected readonly targetLabel = signal('');
  protected readonly warnings = signal<{ name: string; warning: string }[]>([]);
  form = this.blank();

  constructor() {
    this.load();
    this.loadMeta();
    this.loadTree();
  }

  load() {
    let params = new HttpParams();
    if (this.search.trim()) params = params.set('q', this.search.trim());
    if (this.deptFilter) params = params.set('department', this.deptFilter);
    this.http.get<TeamRow[]>(`${this.base}/search`, { params }).subscribe((d) => this.rows.set(d));
  }
  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }
  loadMeta() {
    this.http.get<{ managers: string[]; departments: string[] }>(`${this.base}/managers`).subscribe((m) => {
      this.managerOptions.set(m.managers);
      this.deptValueOptions.set(m.departments);
      this.deptOptions.set([{ label: 'All departments', value: null }, ...m.departments.map((d) => ({ label: d, value: d }))]);
    });
  }
  loadTree() {
    this.http.get<HierNode[]>(`${this.base}/hierarchy`).subscribe((nodes) => this.tree.set(this.toTree(nodes)));
  }

  private toTree(nodes: HierNode[]): TreeNode[] {
    return nodes.map((n) => ({
      label: n.name,
      data: n,
      expanded: true,
      icon: n.isEmployee ? 'pi pi-user' : 'pi pi-users',
      children: this.toTree(n.children)
    }));
  }

  onTreeSelect(e: { node: TreeNode }) {
    const data = e.node.data as HierNode;
    if (data?.isEmployee && data.employeeId) {
      const row = this.rows().find((r) => r.id === data.employeeId);
      if (row) this.openDrawer(row);
      else this.openDrawerById(data.employeeId, data.name);
    }
  }

  openDrawer(row: TeamRow) {
    this.drawerEmp.set(row);
    this.history.set(null);
    this.drawerVisible = true;
    this.http.get<HistoryRow[]>(`${this.base}/employee/${row.id}/history`).subscribe((h) => this.history.set(h));
  }
  private openDrawerById(id: string, name: string) {
    this.drawerEmp.set({ id, name, code: '', email: '', designation: '', department: '', location: '' });
    this.history.set(null);
    this.drawerVisible = true;
    this.http.get<HistoryRow[]>(`${this.base}/employee/${id}/history`).subscribe((h) => this.history.set(h));
  }

  openReassign(targets: TeamRow[]) {
    if (!targets.length) return;
    this.targetIds.set(targets.map((t) => t.id));
    this.targetLabel.set(targets.length === 1 ? targets[0].name : `${targets.length} employees`);
    this.warnings.set([]);
    this.form = this.blank();
    if (targets.length === 1) {
      this.form.manager = targets[0].manager ?? '';
      this.form.department = targets[0].department ?? '';
      this.form.team = targets[0].team ?? '';
    }
    this.drawerVisible = false;
    this.reassignVisible = true;
  }

  preview() {
    this.http.post<{ warnings: { name: string; warning: string }[] }>(`${this.base}/assignments/preview`, this.body())
      .subscribe((r) => {
        this.warnings.set(r.warnings);
        if (!r.warnings.length) this.messages.add({ severity: 'success', summary: 'No conflicts', detail: 'Safe to apply.' });
      });
  }

  submit() {
    this.http.post<{ changed: number; scheduled: boolean }>(`${this.base}/assignments`, this.body()).subscribe({
      next: (r) => {
        this.messages.add({ severity: 'success', summary: r.scheduled ? 'Change scheduled' : 'Hierarchy updated', detail: `${r.changed} employee(s) · ${this.targetLabel()}` });
        this.reassignVisible = false;
        this.selectionModel = [];
        this.selectedRows.set([]);
        this.load();
        this.loadTree();
        this.loadMeta();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Failed', detail: 'Could not apply the reassignment.' })
    });
  }

  isFuture(): boolean {
    return !!this.form.effectiveFrom && this.form.effectiveFrom > new Date().toISOString().slice(0, 10);
  }

  private body() {
    return {
      employeeIds: this.targetIds(),
      manager: this.form.manager?.trim() || null,
      department: this.form.department?.trim() || null,
      team: this.form.team?.trim() || null,
      effectiveFrom: this.form.effectiveFrom,
      reason: this.form.reason?.trim() || null,
      changedBy: this.auth.user()?.fullName ?? 'Admin'
    };
  }

  private blank() {
    return { manager: '', department: '', team: '', effectiveFrom: new Date().toISOString().slice(0, 10), reason: '' };
  }
}
