import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { TreeModule, TreeNodeDropEvent } from 'primeng/tree';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService, TreeNode } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { AuthService } from '@core/services/auth.service';
import { HrAccessService } from '@core/services/hr-access.service';
import { environment } from '@env/environment';

interface Level { rank: number; code: string; title: string; description: string; }
interface ManagerOpt { id: string; name: string; code: string; band: number | null; levelTitle: string; department: string; }
interface EmpRow {
  id: string; code: string; name: string; email: string; department: string; designation: string;
  location: string; band: number | null; levelCode: string; levelTitle: string;
  managerId: string | null; managerName: string | null; managerBand: number | null; directReports: number; avatarUrl?: string; status: string;
}
interface HierNode {
  id: string; name: string; code: string; designation: string; department: string;
  band: number | null; levelCode: string; levelTitle: string; avatarUrl?: string; children: HierNode[];
}
interface TrailNode { employeeId: string; name: string; code: string; band: number | null; levelCode: string; levelTitle: string; designation: string; department: string; avatarUrl?: string; isYou: boolean; }
interface Analytics {
  totalEmployees: number; managers: number; individualContributors: number; avgSpanOfControl: number;
  maxDepth: number; unassigned: number; noBand: number;
  byLevel: { band: number; code: string; title: string; count: number }[];
  byDepartment: { department: string; count: number; avgBand: number }[];
  widestSpans: { manager: string; levelCode: string; directReports: number }[];
}

@Component({
  selector: 'app-hierarchy-management',
  standalone: true,
  imports: [
    FormsModule, TableModule, TreeModule, OrganizationChartModule, ButtonModule, DialogModule,
    SelectModule, InputTextModule, TextareaModule, TooltipModule, SelectButtonModule,
    PageHeaderComponent, KpiCardComponent, AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="HR · Organization" title="Hierarchy Management"
      subtitle="L1–L10 band system, reporting structure and trail-to-CEO. Drag to reassign, change levels and managers dynamically.">
      @if (canManage()) {
        <button pButton severity="secondary" outlined icon="pi pi-upload" label="Bulk upload" (click)="openBulk()"></button>
        <button pButton icon="pi pi-user-plus" label="Add employee" (click)="openAdd()"></button>
      }
    </app-page-header>

    @if (!canManage()) {
      <div class="card px-4 py-2.5 mb-4 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
        <i class="pi pi-info-circle mr-1"></i>View-only access. Changing levels or reporting lines requires Admin, HR or Manager.
      </div>
    }

    <!-- analytics -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
      <app-kpi-card label="Employees" [value]="analytics().totalEmployees" icon="pi-users" tone="brand" caption="in the organization" />
      <app-kpi-card label="Management layers" [value]="analytics().maxDepth" icon="pi-sitemap" tone="indigo" caption="depth, IC → CEO" />
      <app-kpi-card label="Avg span of control" [value]="analytics().avgSpanOfControl" format="1.0-1" icon="pi-share-alt" tone="emerald" [caption]="analytics().managers + ' managers'" />
      <app-kpi-card label="Unassigned" [value]="analytics().unassigned" icon="pi-exclamation-triangle" [tone]="analytics().unassigned ? 'rose' : 'emerald'" caption="no reporting manager" />
    </div>

    <!-- level legend -->
    <div class="card p-3 mb-5 flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold uppercase text-surface-500 mr-1">Bands</span>
      @for (l of levels(); track l.rank) {
        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" [class]="bandClass(l.rank)"
          pTooltip="{{ l.description }}" tooltipPosition="top">
          <span class="font-bold">{{ l.code }}</span>{{ l.title }}
          <span class="opacity-60">· {{ levelCount(l.rank) }}</span>
        </span>
      }
    </div>

    <!-- org structure -->
    <div class="card overflow-hidden mb-5">
      <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-3">
        <div class="section-title mr-auto">Organization tree</div>
        <p-selectButton [options]="viewOptions" [(ngModel)]="view" [allowEmpty]="false" styleClass="!text-xs" />
        <p-select [options]="deptOptions()" [(ngModel)]="deptFilter" (onChange)="loadTree()" placeholder="All departments" [showClear]="true" styleClass="!rounded-lg" />
        <button pButton severity="secondary" text size="small" icon="pi pi-arrows-v" label="Expand all" (click)="expandAll(true)"></button>
        <button pButton severity="secondary" text size="small" icon="pi pi-minus" label="Collapse" (click)="expandAll(false)"></button>
      </div>

      <div class="p-4 overflow-auto" [style.max-height.px]="560">
        @if (view === 'chart') {
          <p-organizationChart [value]="chartNodes()" selectionMode="single" [collapsible]="true"
            (onNodeSelect)="onNodeSelect($event)" styleClass="hierarchy-chart">
            <ng-template let-node pTemplate="default">
              <div class="flex flex-col items-center gap-1.5 px-3 py-2 min-w-[9rem]">
                <app-avatar [name]="node.data.name" [image]="node.data.avatarUrl" size="sm" />
                <div class="text-sm font-medium leading-tight text-center">{{ node.data.name }}</div>
                <div class="text-[11px] text-surface-500 leading-tight text-center">{{ node.data.designation }}</div>
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" [class]="bandClass(node.data.band)">
                  {{ node.data.levelCode }} · {{ node.data.levelTitle }}
                </span>
              </div>
            </ng-template>
          </p-organizationChart>
        } @else {
          <p class="text-[11px] text-surface-500 mb-2">
            <i class="pi pi-info-circle mr-1"></i>
            @if (canManage()) { Drag an employee onto a new manager to reassign reporting. } @else { Read-only view. }
            Click any person to see their trail to the CEO.
          </p>
          <p-tree [value]="treeNodes()" selectionMode="single" (onNodeSelect)="onNodeSelect($event)"
            [draggableNodes]="canManage()" [droppableNodes]="canManage()" draggableScope="hier" droppableScope="hier"
            [validateDrop]="true" (onNodeDrop)="onDrop($event)" styleClass="!border-0 !p-0 text-sm">
            <ng-template let-node pTemplate="default">
              <span class="inline-flex items-center gap-2">
                <span class="font-medium">{{ node.data.name }}</span>
                <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" [class]="bandClass(node.data.band)">{{ node.data.levelCode }}</span>
                <span class="text-[11px] text-surface-500">{{ node.data.designation }}</span>
              </span>
            </ng-template>
          </p-tree>
        }
      </div>
    </div>

    <!-- employee table -->
    <div class="card overflow-hidden">
      <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-3">
        <span class="relative flex-1 min-w-[14rem]">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
          <input pInputText [(ngModel)]="search" (input)="onSearch()" placeholder="Search name, ID, designation…" class="w-full !pl-10 !rounded-lg" />
        </span>
        <p-select [options]="bandFilterOptions()" [(ngModel)]="bandFilter" (onChange)="loadEmployees()" placeholder="All bands" [showClear]="true" styleClass="!rounded-lg" />
        <span class="ml-auto text-xs text-surface-500">{{ rows().length }} employees</span>
      </div>

      <p-table [value]="rows()" responsiveLayout="scroll" [rowHover]="true" [paginator]="rows().length > 12" [rows]="12" dataKey="id">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase">Employee</th>
            <th class="!text-xs !uppercase">Band</th>
            <th class="!text-xs !uppercase">Department</th>
            <th class="!text-xs !uppercase">Reporting manager</th>
            <th class="!text-xs !uppercase !text-center">Reports</th>
            <th class="!text-xs !uppercase !text-right">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-r>
          <tr>
            <td>
              <button type="button" class="flex items-center gap-3 text-left group" (click)="openTrail(r)">
                <app-avatar [name]="r.name" [image]="r.avatarUrl" size="sm" />
                <div class="min-w-0">
                  <div class="font-medium truncate group-hover:text-brand-600">{{ r.name }}</div>
                  <div class="text-[11px] text-surface-500">{{ r.code }} · {{ r.designation }}</div>
                </div>
              </button>
            </td>
            <td>
              <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" [class]="bandClass(r.band)">
                {{ r.levelCode }} · {{ r.levelTitle }}
              </span>
            </td>
            <td class="text-sm">{{ r.department }}</td>
            <td class="text-sm">
              @if (r.managerName) { {{ r.managerName }} } @else { <span class="text-surface-400">— top of org</span> }
            </td>
            <td class="text-center text-sm">{{ r.directReports || '—' }}</td>
            <td class="text-right">
              <div class="flex justify-end gap-1">
                <button pButton text rounded size="small" icon="pi pi-arrow-up" pTooltip="Trail to CEO" class="!text-surface-500" (click)="openTrail(r)"></button>
                @if (canManage()) {
                  <button pButton text rounded size="small" icon="pi pi-tag" pTooltip="Change band" class="!text-surface-500" (click)="openBand(r)"></button>
                  <button pButton text rounded size="small" icon="pi pi-sitemap" pTooltip="Assign manager" class="!text-surface-500" (click)="openMgr(r)"></button>
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="6" class="py-10 text-center text-surface-500">No employees match.</td></tr></ng-template>
      </p-table>
    </div>

    <!-- reporting trail dialog -->
    <p-dialog [(visible)]="trailOpen" [modal]="true" [style]="{ width: '26rem' }" [draggable]="false" [dismissableMask]="true"
      [header]="'Reporting trail · ' + (trailEmp()?.name || '')">
      @if (trail(); as t) {
        <div class="flex flex-col items-stretch gap-0 pt-1">
          @for (n of t; track n.employeeId; let i = $index) {
            <div class="flex items-center gap-3 rounded-xl border p-2.5"
              [class]="n.isYou ? 'border-brand-300 bg-brand-50/60 dark:bg-brand-500/10' : 'border-surface-200 dark:border-surface-700'">
              <app-avatar [name]="n.name" [image]="n.avatarUrl" size="sm" />
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate">{{ n.name }} @if (n.isYou) { <span class="text-[10px] text-brand-600">(you)</span> }</div>
                <div class="text-[11px] text-surface-500">{{ n.designation }} · {{ n.department }}</div>
              </div>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" [class]="bandClass(n.band)">{{ n.levelCode }}</span>
            </div>
            @if (i < t.length - 1) { <div class="grid place-items-center py-0.5 text-surface-400"><i class="pi pi-arrow-up text-xs"></i></div> }
          }
        </div>
      } @else {
        <div class="py-6 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner"></i></div>
      }
      <ng-template pTemplate="footer"><button pButton label="Close" (click)="trailOpen.set(false)"></button></ng-template>
    </p-dialog>

    <!-- change band dialog -->
    <p-dialog [(visible)]="bandOpen" [modal]="true" [style]="{ width: '26rem' }" [draggable]="false" [header]="'Change band · ' + (bandTarget()?.name || '')">
      <div class="flex flex-col gap-3 pt-1">
        <label class="text-sm font-medium">Hierarchy band / level</label>
        <p-select [options]="levelOptions()" [(ngModel)]="bandValue" appendTo="body" placeholder="Select level" />
        <p class="text-xs text-surface-500">Current: <span class="font-medium">{{ bandTarget()?.levelCode }} · {{ bandTarget()?.levelTitle }}</span></p>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Cancel" (click)="bandOpen.set(false)"></button>
        <button pButton label="Save band" icon="pi pi-check" [disabled]="!bandValue()" (click)="saveBand()"></button>
      </ng-template>
    </p-dialog>

    <!-- assign manager dialog -->
    <p-dialog [(visible)]="mgrOpen" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false" [header]="'Assign manager · ' + (mgrTarget()?.name || '')">
      <div class="flex flex-col gap-3 pt-1">
        <label class="text-sm font-medium">Reporting manager</label>
        <p-select [options]="managerOptions()" [(ngModel)]="mgrValue" (onChange)="previewMgr()" [filter]="true" filterBy="label"
          appendTo="body" placeholder="Select manager" [showClear]="true" />
        <div>
          <label class="text-sm font-medium">Reason <span class="text-surface-400 font-normal">(optional)</span></label>
          <input pInputText [(ngModel)]="mgrReason" class="w-full mt-1" placeholder="e.g. Team restructure, transfer…" />
        </div>
        @if (mgrWarning()) {
          <div class="rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <i class="pi pi-exclamation-triangle mr-1"></i>{{ mgrWarning() }}
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Cancel" (click)="mgrOpen.set(false)"></button>
        <button pButton label="Save" icon="pi pi-check" [disabled]="!!mgrWarning()" (click)="saveMgr()"></button>
      </ng-template>
    </p-dialog>

    <!-- add employee dialog -->
    <p-dialog [(visible)]="addOpen" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false" header="Add employee">
      <div class="grid grid-cols-2 gap-4 pt-1">
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Full name</label><input pInputText [(ngModel)]="add().name" placeholder="Jane Cooper" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Employee ID <span class="text-surface-400 font-normal">(auto)</span></label><input pInputText [(ngModel)]="add().code" placeholder="YUG-1013" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Email</label><input pInputText [(ngModel)]="add().email" placeholder="jane@yugma.io" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Department</label><input pInputText [(ngModel)]="add().department" placeholder="Engineering" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Designation</label><input pInputText [(ngModel)]="add().designation" placeholder="Software Engineer" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Band / level</label><p-select [options]="levelOptions()" [(ngModel)]="add().band" appendTo="body" placeholder="Select level" /></div>
        <div class="flex flex-col gap-1.5 col-span-2"><label class="text-sm font-medium">Reporting manager</label>
          <p-select [options]="managerOptions()" [(ngModel)]="add().managerId" [filter]="true" filterBy="label" appendTo="body" placeholder="Select manager" [showClear]="true" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Cancel" (click)="addOpen.set(false)"></button>
        <button pButton label="Add employee" icon="pi pi-check" [disabled]="!addValid()" (click)="saveAdd()"></button>
      </ng-template>
    </p-dialog>

    <!-- bulk upload dialog -->
    <p-dialog [(visible)]="bulkOpen" [modal]="true" [style]="{ width: '36rem' }" [draggable]="false" header="Bulk upload hierarchy">
      <div class="flex flex-col gap-3 pt-1">
        <p class="text-sm text-surface-500">Paste one row per line: <code class="text-xs bg-surface-100 dark:bg-surface-800 px-1 rounded">EMP_CODE, BAND, MANAGER_CODE</code>. Band (1–10) and manager are optional.</p>
        <textarea pTextarea [(ngModel)]="bulkText" rows="8" class="w-full font-mono text-xs"
          placeholder="YUG-1005, 4, YUG-1006&#10;YUG-1007, 3,&#10;YUG-1009, , YUG-1008"></textarea>
        @if (bulkResult(); as br) {
          <div class="rounded-lg p-3 text-xs" [class]="br.skipped ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'">
            <div class="font-medium">{{ br.applied }} applied · {{ br.skipped }} skipped</div>
            @for (e of br.errors; track $index) { <div class="mt-1">• {{ e.code }}: {{ e.error }}</div> }
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Close" (click)="bulkOpen.set(false)"></button>
        <button pButton label="Apply rows" icon="pi pi-upload" [disabled]="!bulkText().trim()" (click)="runBulk()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep .hierarchy-chart .p-organizationchart-node { border-radius: 0.75rem; border: 1px solid var(--p-surface-200); background: var(--p-surface-0); }
    :host ::ng-deep .hierarchy-chart .p-organizationchart-node.p-organizationchart-node-selectable:not(.p-organizationchart-node-selected):hover { background: var(--p-surface-100); }
  `]
})
export class HierarchyManagementComponent {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(MessageService);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiBaseUrl}/hr/hierarchy`;

  private readonly hrAccess = inject(HrAccessService);
  // Department-aware: HR staff (and admins/owners) manage; everyone else is read-only / own-data.
  protected readonly canManage = computed(() => this.hrAccess.canManage());

  protected readonly rows = signal<EmpRow[]>([]);
  protected readonly levels = signal<Level[]>([]);
  protected readonly analytics = signal<Analytics>({ totalEmployees: 0, managers: 0, individualContributors: 0, avgSpanOfControl: 0, maxDepth: 0, unassigned: 0, noBand: 0, byLevel: [], byDepartment: [], widestSpans: [] });
  protected readonly managers = signal<ManagerOpt[]>([]);
  protected readonly departments = signal<string[]>([]);
  protected readonly treeNodes = signal<TreeNode[]>([]);
  protected readonly chartNodes = signal<TreeNode[]>([]);

  protected view: 'chart' | 'tree' = 'chart';
  protected readonly viewOptions = [{ label: 'Org chart', value: 'chart' }, { label: 'Tree', value: 'tree' }];
  protected search = '';
  protected bandFilter: number | null = null;
  protected deptFilter: string | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;

  // dialogs
  protected readonly trailOpen = signal(false);
  protected readonly trailEmp = signal<EmpRow | null>(null);
  protected readonly trail = signal<TrailNode[] | null>(null);

  protected readonly bandOpen = signal(false);
  protected readonly bandTarget = signal<EmpRow | null>(null);
  protected readonly bandValue = signal<number | null>(null);

  protected readonly mgrOpen = signal(false);
  protected readonly mgrTarget = signal<EmpRow | null>(null);
  protected readonly mgrValue = signal<string | null>(null);
  protected mgrReason = '';
  protected readonly mgrWarning = signal<string | null>(null);

  protected readonly addOpen = signal(false);
  protected readonly add = signal<{ name: string; code: string; email: string; department: string; designation: string; band: number | null; managerId: string | null }>(this.blankAdd());

  protected readonly bulkOpen = signal(false);
  protected readonly bulkText = signal('');
  protected readonly bulkResult = signal<{ applied: number; skipped: number; errors: { code: string; error: string }[] } | null>(null);

  // option lists
  protected readonly deptOptions = computed(() => this.departments().map((d) => ({ label: d, value: d })));
  protected readonly levelOptions = computed(() => this.levels().map((l) => ({ label: `${l.code} · ${l.title}`, value: l.rank })));
  protected readonly bandFilterOptions = computed(() => this.levels().map((l) => ({ label: `${l.code} · ${l.title}`, value: l.rank })));
  protected readonly managerOptions = computed(() => {
    const excludeId = this.mgrTarget()?.id;
    return this.managers().filter((m) => m.id !== excludeId).map((m) => ({ label: `${m.name} · ${m.levelTitle}`, value: m.id }));
  });

  constructor() {
    this.loadLevels();
    this.loadMeta();
    this.loadEmployees();
    this.loadTree();
    this.loadAnalytics();
  }

  // ---------------- loaders ----------------
  private loadLevels() { this.http.get<Level[]>(`${this.base}/levels`).subscribe((l) => this.levels.set(l)); }
  private loadMeta() {
    this.http.get<{ departments: string[]; managers: ManagerOpt[] }>(`${this.base}/meta`).subscribe((m) => {
      this.departments.set(m.departments); this.managers.set(m.managers);
    });
  }
  loadEmployees() {
    let params = new HttpParams();
    if (this.search.trim()) params = params.set('q', this.search.trim());
    if (this.bandFilter) params = params.set('band', String(this.bandFilter));
    this.http.get<EmpRow[]>(`${this.base}/employees`, { params }).subscribe((r) => this.rows.set(r));
  }
  loadTree() {
    let params = new HttpParams();
    if (this.deptFilter) params = params.set('department', this.deptFilter);
    this.http.get<HierNode[]>(`${this.base}/tree`, { params }).subscribe((nodes) => {
      this.treeNodes.set(this.toNodes(nodes, true));
      this.chartNodes.set(this.toNodes(nodes, true));
    });
  }
  private loadAnalytics() { this.http.get<Analytics>(`${this.base}/analytics`).subscribe((a) => this.analytics.set(a)); }
  private refresh() { this.loadEmployees(); this.loadTree(); this.loadAnalytics(); this.loadMeta(); }

  onSearch() { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.loadEmployees(), 250); }

  private toNodes(nodes: HierNode[], expanded: boolean): TreeNode[] {
    return nodes.map((n) => ({
      label: n.name,
      data: n,
      expanded,
      type: 'default',
      children: this.toNodes(n.children, expanded)
    }));
  }

  expandAll(state: boolean) {
    const walk = (ns: TreeNode[]) => ns.forEach((n) => { n.expanded = state; if (n.children) walk(n.children); });
    const t = structuredClone(this.treeNodes()); walk(t); this.treeNodes.set(t);
    const c = structuredClone(this.chartNodes()); walk(c); this.chartNodes.set(c);
  }

  // ---------------- selection ----------------
  onNodeSelect(e: { node: TreeNode }) {
    const data = e.node?.data as HierNode | undefined;
    if (!data?.id) return;
    const row = this.rows().find((r) => r.id === data.id);
    if (row) this.openTrail(row);
    else this.openTrailById(data.id, data.name);
  }

  // ---------------- trail ----------------
  openTrail(r: EmpRow) { this.openTrailById(r.id, r.name, r); }
  private openTrailById(id: string, name: string, row?: EmpRow) {
    this.trailEmp.set(row ?? ({ id, name } as EmpRow));
    this.trail.set(null);
    this.trailOpen.set(true);
    this.http.get<TrailNode[]>(`${this.base}/employee/${id}/trail`).subscribe((t) => this.trail.set(t));
  }

  // ---------------- band ----------------
  openBand(r: EmpRow) { this.bandTarget.set(r); this.bandValue.set(r.band); this.bandOpen.set(true); }
  saveBand() {
    const t = this.bandTarget(); if (!t || !this.bandValue()) return;
    this.http.post(`${this.base}/employee/${t.id}/band`, { band: this.bandValue(), actedBy: this.actor() }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Band updated', detail: `${t.name} set to L${this.bandValue()}.` }); this.bandOpen.set(false); this.refresh(); },
      error: (e) => this.fail(e)
    });
  }

  // ---------------- manager ----------------
  openMgr(r: EmpRow) {
    this.mgrTarget.set(r); this.mgrValue.set(r.managerId); this.mgrReason = ''; this.mgrWarning.set(null); this.mgrOpen.set(true);
  }
  previewMgr() {
    const t = this.mgrTarget(); if (!t) return;
    this.http.post<{ ok: boolean; warning: string | null }>(`${this.base}/employee/${t.id}/manager/preview`, { managerId: this.mgrValue() })
      .subscribe((r) => this.mgrWarning.set(r.ok ? null : r.warning));
  }
  saveMgr() {
    const t = this.mgrTarget(); if (!t) return;
    this.http.post(`${this.base}/employee/${t.id}/manager`, { managerId: this.mgrValue(), reason: this.mgrReason || null, actedBy: this.actor() }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Reporting updated', detail: `${t.name}'s manager changed.` }); this.mgrOpen.set(false); this.refresh(); },
      error: (e) => this.fail(e)
    });
  }

  // ---------------- drag & drop ----------------
  onDrop(e: TreeNodeDropEvent) {
    const drag = e.dragNode?.data as HierNode | undefined;
    const drop = e.dropNode?.data as HierNode | undefined;
    if (!drag?.id) return;
    const newManagerId = drop?.id ?? null;
    if (newManagerId === drag.id) return;
    this.http.post(`${this.base}/employee/${drag.id}/manager`, { managerId: newManagerId, reason: 'Drag-and-drop reassignment', actedBy: this.actor() }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Reassigned', detail: `${drag.name} → ${drop?.name ?? 'top of org'}.` }); this.refresh(); },
      error: (err) => { this.fail(err); this.loadTree(); }
    });
  }

  // ---------------- add ----------------
  openAdd() { this.add.set(this.blankAdd()); this.addOpen.set(true); }
  addValid(): boolean { const a = this.add(); return a.name.trim().length > 1 && /.+@.+\..+/.test(a.email) && !!a.department.trim() && !!a.designation.trim() && !!a.band; }
  saveAdd() {
    const a = this.add();
    this.http.post(`${this.base}/employee`, {
      name: a.name, code: a.code || null, email: a.email, department: a.department, designation: a.designation,
      band: a.band, managerId: a.managerId, actedBy: this.actor()
    }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Employee added', detail: `${a.name} added to the hierarchy.` }); this.addOpen.set(false); this.refresh(); },
      error: (e) => this.fail(e)
    });
  }

  // ---------------- bulk ----------------
  openBulk() { this.bulkText.set(''); this.bulkResult.set(null); this.bulkOpen.set(true); }
  runBulk() {
    const items = this.bulkText().split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [code, band, managerCode] = line.split(',').map((s) => s.trim());
      return { code, band: band ? Number(band) : null, managerCode: managerCode || null };
    }).filter((i) => i.code);
    if (!items.length) return;
    this.http.post<{ applied: number; skipped: number; errors: { code: string; error: string }[] }>(`${this.base}/bulk`, { items, actedBy: this.actor() }).subscribe({
      next: (r) => {
        this.bulkResult.set(r);
        this.toast.add({ severity: r.skipped ? 'warn' : 'success', summary: 'Bulk upload', detail: `${r.applied} applied, ${r.skipped} skipped.` });
        this.refresh();
      },
      error: (e) => this.fail(e)
    });
  }

  // ---------------- helpers ----------------
  levelCount(rank: number): number { return this.analytics().byLevel.find((l) => l.band === rank)?.count ?? 0; }

  bandClass(band: number | null): string {
    if (band == null) return 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300';
    if (band >= 10) return 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300';
    if (band >= 8) return 'bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300';
    if (band >= 7) return 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300';
    if (band >= 5) return 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300';
    if (band >= 4) return 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300';
    if (band >= 3) return 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    return 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300';
  }

  private actor(): string { return this.auth.user()?.fullName ?? 'Admin'; }
  private fail(e: unknown) {
    const detail = (e as { error?: { error?: string } })?.error?.error ?? 'Something went wrong.';
    this.toast.add({ severity: 'error', summary: 'Action failed', detail });
  }
  private blankAdd() { return { name: '', code: '', email: '', department: '', designation: '', band: 2 as number | null, managerId: null as string | null }; }
}
