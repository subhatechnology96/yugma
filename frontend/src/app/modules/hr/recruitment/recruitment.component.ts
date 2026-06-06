import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { environment } from '@env/environment';

type Stage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

interface Candidate {
  id: string; name: string; role: string; source: string; stage: Stage; rating: number;
  appliedAt: string; lastActivityAt: string; email?: string; location?: string;
  experienceYears: number; expectedCtcLakhs: number; owner?: string;
}
interface Summary {
  openRoles: number; openPositions: number; departments: number; inPipeline: number;
  offersOut: number; hiredQtd: number;
  funnel: { applied: number; screening: number; interview: number; offer: number; hired: number; rejected: number };
  bySource: { source: string; count: number }[];
}
interface JobRole {
  id: string; title: string; department: string; location: string; employmentType: string;
  openings: number; status: string; priority: string; hiringManager?: string;
  budgetCtcLakhs: number; postedAt: string; applicants: number; inPipeline: number;
}

const STAGES: { key: Stage; label: string; header: string; col: string }[] = [
  { key: 'applied', label: 'Applied', header: 'text-surface-600', col: 'bg-surface-50 dark:bg-surface-900/40' },
  { key: 'screening', label: 'Screening', header: 'text-brand-600', col: 'bg-brand-50/50 dark:bg-brand-500/5' },
  { key: 'interview', label: 'Interview', header: 'text-indigo-600', col: 'bg-indigo-50/50 dark:bg-indigo-500/5' },
  { key: 'offer', label: 'Offer', header: 'text-amber-600', col: 'bg-amber-50/50 dark:bg-amber-500/5' },
  { key: 'hired', label: 'Hired', header: 'text-emerald-600', col: 'bg-emerald-50/50 dark:bg-emerald-500/5' },
  { key: 'rejected', label: 'Rejected', header: 'text-rose-600', col: 'bg-rose-50/40 dark:bg-rose-500/5' }
];

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, FormsModule, DragDropModule,
    ButtonModule, TabsModule, TableModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, TooltipModule,
    PageHeaderComponent, KpiCardComponent, StatusPillComponent, AvatarComponent, HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Talent" title="Recruitment" subtitle="Applicant tracking — drag candidates across stages, manage open roles and track the hiring funnel.">
      <button pButton severity="secondary" outlined icon="pi pi-plus" label="Add candidate" (click)="openAdd()"></button>
    </app-page-header>

    <app-hr-agent-rail stage="recruitment" />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Open roles" [value]="summary().openRoles" icon="pi-briefcase" tone="brand" [caption]="summary().openPositions + ' positions · ' + summary().departments + ' departments'" />
      <app-kpi-card label="Candidates in pipeline" [value]="summary().inPipeline" icon="pi-users" tone="indigo" caption="active applicants" />
      <app-kpi-card label="Offers out" [value]="summary().offersOut" icon="pi-send" tone="amber" caption="awaiting decision" />
      <app-kpi-card label="Hired (QTD)" [value]="summary().hiredQtd" icon="pi-check-circle" tone="emerald" caption="this quarter" />
    </div>

    <div class="card">
      <p-tabs value="pipeline">
        <p-tablist>
          <p-tab value="pipeline">Pipeline</p-tab>
          <p-tab value="roles">Open roles ({{ openRolesCount() }})</p-tab>
          <p-tab value="analytics">Analytics</p-tab>
        </p-tablist>
        <p-tabpanels>
          <!-- ===================== PIPELINE ===================== -->
          <p-tabpanel value="pipeline">
            <div class="p-2">
              <div class="flex gap-3 overflow-x-auto pb-2" cdkDropListGroup>
                @for (col of stages; track col.key) {
                  <div class="min-w-[230px] flex-1 flex flex-col">
                    <div class="flex items-center justify-between mb-2 px-1">
                      <div class="text-sm font-semibold" [class]="col.header">{{ col.label }}</div>
                      <span class="pill-neutral">{{ lists()[col.key].length }}</span>
                    </div>
                    <div
                      class="rounded-2xl p-2 space-y-2 flex-1 min-h-[320px] transition-colors"
                      [class]="col.col"
                      cdkDropList
                      [cdkDropListData]="lists()[col.key]"
                      (cdkDropListDropped)="drop($event, col.key)"
                    >
                      @for (c of lists()[col.key]; track c.id) {
                        <div
                          class="bg-white dark:bg-surface-900 rounded-xl p-3 border border-surface-200 dark:border-surface-800 shadow-soft hover:shadow-card transition cursor-grab active:cursor-grabbing"
                          cdkDrag
                          (click)="openDetail(c)"
                        >
                          <div class="flex items-center gap-2">
                            <app-avatar [name]="c.name" size="xs" />
                            <div class="min-w-0 flex-1">
                              <div class="text-sm font-medium truncate">{{ c.name }}</div>
                              <div class="text-[11px] text-surface-500 truncate">{{ c.role }}</div>
                            </div>
                          </div>
                          <div class="flex items-center gap-1 mt-2 text-[10px] text-surface-500">
                            <i class="pi pi-briefcase text-[9px]"></i> {{ c.experienceYears }}y
                            <span>·</span>
                            <i class="pi pi-map-marker text-[9px]"></i> {{ c.location }}
                          </div>
                          <div class="flex items-center justify-between mt-2">
                            <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">{{ c.source }}</span>
                            <div class="flex items-center gap-0.5 text-amber-500">
                              @for (s of [1,2,3,4,5]; track s) {
                                <i class="pi text-[9px]" [class.pi-star-fill]="s <= c.rating" [class.pi-star]="s > c.rating" [class.text-surface-300]="s > c.rating"></i>
                              }
                            </div>
                          </div>
                        </div>
                      }
                      @if (!lists()[col.key].length) {
                        <div class="text-center text-[11px] text-surface-400 py-6">Drop here</div>
                      }
                    </div>
                  </div>
                }
              </div>
              <p class="text-[11px] text-surface-400 mt-2 px-1"><i class="pi pi-info-circle mr-1"></i>Drag a card to move a candidate between stages, or click it to view details.</p>
            </div>
          </p-tabpanel>

          <!-- ===================== OPEN ROLES ===================== -->
          <p-tabpanel value="roles">
            <p-table [value]="roles()" responsiveLayout="scroll" [rowHover]="true" class="p-2">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-xs !uppercase !text-surface-500">Role</th>
                  <th class="!text-xs !uppercase !text-surface-500">Department</th>
                  <th class="!text-xs !uppercase !text-surface-500">Location</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Openings</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Applicants</th>
                  <th class="!text-xs !uppercase !text-surface-500">Priority</th>
                  <th class="!text-xs !uppercase !text-surface-500">Status</th>
                  <th class="!text-xs !uppercase !text-surface-500">Hiring manager</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-r>
                <tr>
                  <td>
                    <div class="font-medium">{{ r.title }}</div>
                    <div class="text-[11px] text-surface-500">{{ r.employmentType }} · ₹{{ r.budgetCtcLakhs | number: '1.0-0' }}L · posted {{ r.postedAt | date: 'mediumDate' }}</div>
                  </td>
                  <td class="text-sm">{{ r.department }}</td>
                  <td class="text-sm">{{ r.location }}</td>
                  <td class="text-right tabular-nums">{{ r.openings }}</td>
                  <td class="text-right tabular-nums">
                    <span class="font-medium">{{ r.applicants }}</span>
                    <span class="text-[11px] text-surface-500"> · {{ r.inPipeline }} active</span>
                  </td>
                  <td>
                    <span class="text-xs font-medium" [class.text-rose-600]="r.priority === 'High'" [class.text-amber-600]="r.priority === 'Medium'" [class.text-surface-500]="r.priority === 'Low'">
                      <i class="pi pi-flag-fill text-[9px] mr-1"></i>{{ r.priority }}
                    </span>
                  </td>
                  <td><app-status-pill [tone]="roleTone(r.status)">{{ r.status }}</app-status-pill></td>
                  <td class="text-sm text-surface-500">{{ r.hiringManager || '—' }}</td>
                </tr>
              </ng-template>
            </p-table>
          </p-tabpanel>

          <!-- ===================== ANALYTICS ===================== -->
          <p-tabpanel value="analytics">
            <div class="p-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                <div class="section-title mb-3">Hiring funnel</div>
                <div class="space-y-2.5">
                  @for (f of funnelRows(); track f.label) {
                    <div>
                      <div class="flex items-center justify-between text-xs mb-1">
                        <span class="font-medium">{{ f.label }}</span>
                        <span class="text-surface-500">{{ f.count }} <span class="text-surface-400">· {{ f.pct }}%</span></span>
                      </div>
                      <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                        <div class="h-full rounded-full" [class]="f.color" [style.width.%]="f.pct"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                <div class="section-title mb-3">Candidates by source</div>
                <div class="space-y-2.5">
                  @for (s of summary().bySource; track s.source) {
                    <div>
                      <div class="flex items-center justify-between text-xs mb-1">
                        <span class="font-medium">{{ s.source }}</span>
                        <span class="text-surface-500">{{ s.count }}</span>
                      </div>
                      <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                        <div class="h-full rounded-full bg-brand-500" [style.width.%]="sourcePct(s.count)"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <!-- ===================== Candidate detail ===================== -->
    <p-dialog [(visible)]="detailVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="detail()?.name || ''" [draggable]="false" [dismissableMask]="true">
      @if (detail(); as c) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center gap-3">
            <app-avatar [name]="c.name" size="lg" />
            <div class="min-w-0">
              <div class="font-semibold">{{ c.name }}</div>
              <div class="text-xs text-surface-500">{{ c.role }}</div>
              <div class="flex items-center gap-0.5 text-amber-500 mt-1">
                @for (s of [1,2,3,4,5]; track s) {
                  <i class="pi text-xs" [class.pi-star-fill]="s <= c.rating" [class.pi-star]="s > c.rating" [class.text-surface-300]="s > c.rating"></i>
                }
              </div>
            </div>
            <div class="ml-auto"><app-status-pill [tone]="stageTone(c.stage)">{{ stageLabel(c.stage) }}</app-status-pill></div>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt class="text-[11px] uppercase text-surface-400">Email</dt><dd class="font-medium truncate">{{ c.email || '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Location</dt><dd class="font-medium">{{ c.location || '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Experience</dt><dd class="font-medium">{{ c.experienceYears }} years</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Expected CTC</dt><dd class="font-medium">₹{{ c.expectedCtcLakhs | number: '1.0-0' }} L</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Source</dt><dd class="font-medium">{{ c.source }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Recruiter</dt><dd class="font-medium">{{ c.owner || '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Applied</dt><dd class="font-medium">{{ c.appliedAt | date: 'mediumDate' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Last activity</dt><dd class="font-medium">{{ c.lastActivityAt | date: 'mediumDate' }}</dd></div>
          </dl>

          <div>
            <label class="text-xs font-medium text-surface-600">Move to stage</label>
            <p-select [options]="stageOptions" [(ngModel)]="moveStage" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" />
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Edit" icon="pi pi-pencil" (click)="editFromDetail()"></button>
        <button pButton severity="secondary" outlined label="Close" (click)="detailVisible = false"></button>
        <button pButton label="Update stage" icon="pi pi-check" (click)="applyMove()"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Add / Edit candidate ===================== -->
    <p-dialog [(visible)]="formVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="editId ? 'Edit candidate' : 'Add candidate'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Full name</label>
          <input pInputText [(ngModel)]="form.name" class="w-full mt-1 !rounded-lg" placeholder="Candidate name" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Role</label>
          <p-select [options]="roleOptions()" [(ngModel)]="form.role" [editable]="true" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" placeholder="Role" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Source</label>
          <p-select [options]="sourceOptions" [(ngModel)]="form.source" styleClass="w-full mt-1 !rounded-lg" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Email</label>
          <input pInputText [(ngModel)]="form.email" class="w-full mt-1 !rounded-lg" placeholder="name@email.com" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Location</label>
          <input pInputText [(ngModel)]="form.location" class="w-full mt-1 !rounded-lg" placeholder="City" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Experience (years)</label>
          <p-inputNumber [(ngModel)]="form.experienceYears" [min]="0" [max]="40" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Expected CTC (₹L)</label>
          <p-inputNumber [(ngModel)]="form.expectedCtcLakhs" [min]="0" [max]="500" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Rating</label>
          <p-select [options]="ratingOptions" [(ngModel)]="form.rating" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Stage</label>
          <p-select [options]="stageOptions" [(ngModel)]="form.stage" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" [disabled]="!!editId" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Recruiter</label>
          <input pInputText [(ngModel)]="form.owner" class="w-full mt-1 !rounded-lg" placeholder="Owner" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="formVisible = false"></button>
        <button pButton [label]="editId ? 'Save' : 'Add candidate'" [disabled]="!form.name?.trim() || !form.role?.trim()" (click)="submit()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class RecruitmentComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/my-work`;

  protected readonly stages = STAGES;
  protected readonly lists = signal<Record<Stage, Candidate[]>>({ applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [] });
  protected readonly roles = signal<JobRole[]>([]);
  protected readonly summary = signal<Summary>({ openRoles: 0, openPositions: 0, departments: 0, inPipeline: 0, offersOut: 0, hiredQtd: 0, funnel: { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 }, bySource: [] });

  protected readonly openRolesCount = computed(() => this.roles().filter((r) => r.status === 'Open').length);
  protected readonly roleOptions = computed(() => {
    const titles = Array.from(new Set(this.roles().map((r) => r.title)));
    return titles.map((t) => ({ label: t, value: t }));
  });

  protected readonly stageOptions = STAGES.map((s) => ({ label: s.label, value: s.key }));
  protected readonly sourceOptions = ['Referral', 'LinkedIn', 'Naukri', 'Inbound', 'Hackathon', 'Indeed', 'Instahyre'].map((s) => ({ label: s, value: s }));
  protected readonly ratingOptions = [1, 2, 3, 4, 5].map((n) => ({ label: n + ' ★', value: n }));

  detailVisible = false;
  protected readonly detail = signal<Candidate | null>(null);
  moveStage: Stage = 'applied';

  formVisible = false;
  editId: string | null = null;
  form = this.blank();

  constructor() {
    this.reload();
  }

  reload() {
    forkJoin({
      candidates: this.http.get<Candidate[]>(`${this.base}/candidates`),
      roles: this.http.get<JobRole[]>(`${this.base}/roles`),
      summary: this.http.get<Summary>(`${this.base}/candidates/summary`)
    }).subscribe((r) => {
      this.roles.set(r.roles);
      this.summary.set(r.summary);
      this.group(r.candidates);
    });
  }

  private group(candidates: Candidate[]) {
    const map: Record<Stage, Candidate[]> = { applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [] };
    for (const c of candidates) (map[c.stage] ?? map.applied).push(c);
    this.lists.set(map);
  }

  // ---- drag & drop ----
  drop(event: CdkDragDrop<Candidate[]>, target: Stage) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.lists.set({ ...this.lists() });
      return;
    }
    const moved = event.previousContainer.data[event.previousIndex];
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    moved.stage = target;
    this.lists.set({ ...this.lists() });
    this.persistStage(moved, target);
  }

  private persistStage(c: Candidate, stage: Stage) {
    this.http.post(`${this.base}/candidates/${c.id}/stage`, { stage }).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Stage updated', detail: `${c.name} → ${this.stageLabel(stage)}` });
        this.refreshSummary();
      },
      error: () => {
        this.messages.add({ severity: 'error', summary: 'Move failed', detail: 'Could not update the candidate.' });
        this.reload();
      }
    });
  }

  private refreshSummary() {
    this.http.get<Summary>(`${this.base}/candidates/summary`).subscribe((s) => this.summary.set(s));
  }

  // ---- detail ----
  openDetail(c: Candidate) {
    this.detail.set(c);
    this.moveStage = c.stage;
    this.detailVisible = true;
  }
  applyMove() {
    const c = this.detail();
    if (!c || this.moveStage === c.stage) { this.detailVisible = false; return; }
    // optimistic local move
    const map = this.lists();
    map[c.stage] = map[c.stage].filter((x) => x.id !== c.id);
    c.stage = this.moveStage;
    map[this.moveStage] = [c, ...map[this.moveStage]];
    this.lists.set({ ...map });
    this.persistStage(c, this.moveStage);
    this.detailVisible = false;
  }

  // ---- add / edit ----
  openAdd() {
    this.editId = null;
    this.form = this.blank();
    this.formVisible = true;
  }
  editFromDetail() {
    const c = this.detail();
    if (!c) return;
    this.editId = c.id;
    this.form = { name: c.name, role: c.role, source: c.source, email: c.email ?? '', location: c.location ?? '', experienceYears: c.experienceYears, expectedCtcLakhs: c.expectedCtcLakhs, rating: c.rating, stage: c.stage, owner: c.owner ?? '' };
    this.detailVisible = false;
    this.formVisible = true;
  }
  submit() {
    const body = { ...this.form };
    const req = this.editId
      ? this.http.put(`${this.base}/candidates/${this.editId}`, body)
      : this.http.post(`${this.base}/candidates`, body);
    req.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: this.editId ? 'Candidate updated' : 'Candidate added', detail: body.name });
        this.formVisible = false;
        this.reload();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not save the candidate.' })
    });
  }

  // ---- helpers ----
  protected readonly funnelRows = computed(() => {
    const f = this.summary().funnel;
    const max = Math.max(f.applied, f.screening, f.interview, f.offer, f.hired, 1);
    const mk = (label: string, count: number, color: string) => ({ label, count, color, pct: Math.round((count / max) * 100) });
    return [
      mk('Applied', f.applied, 'bg-surface-400'),
      mk('Screening', f.screening, 'bg-brand-500'),
      mk('Interview', f.interview, 'bg-indigo-500'),
      mk('Offer', f.offer, 'bg-amber-500'),
      mk('Hired', f.hired, 'bg-emerald-500')
    ];
  });

  sourcePct(count: number): number {
    const max = Math.max(...this.summary().bySource.map((s) => s.count), 1);
    return Math.round((count / max) * 100);
  }

  stageLabel(s: Stage): string { return STAGES.find((x) => x.key === s)?.label ?? s; }
  stageTone(s: Stage): StatusTone {
    return ({ applied: 'neutral', screening: 'info', interview: 'info', offer: 'warn', hired: 'success', rejected: 'danger' } as Record<Stage, StatusTone>)[s];
  }
  roleTone(s: string): StatusTone { return s === 'Open' ? 'success' : s === 'OnHold' ? 'warn' : 'neutral'; }

  private blank() {
    return { name: '', role: '', source: 'Inbound', email: '', location: 'Bengaluru', experienceYears: 3, expectedCtcLakhs: 12, rating: 3, stage: 'applied' as Stage, owner: 'Niharika Joshi' };
  }
}
